import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as ed25519Sign,
  verify as ed25519Verify,
} from "node:crypto";

const QQ_API_BASE = "https://api.bot.qq.com";
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export interface QQCallbackPayload {
  id?: string;
  op: number;
  t?: string;
  d?: any;
}

export interface QQIncomingMessage {
  eventId: string;
  messageId: string;
  authorOpenId: string;
  targetOpenId: string;
  kind: "c2c" | "group";
  content: string;
}

function privateKeyFromSecret(secret: string) {
  let seed = Buffer.from(secret, "utf8");
  while (seed.length > 0 && seed.length < 32) seed = Buffer.concat([seed, seed]);
  if (seed.length === 0) throw new Error("QQ_BOT_APP_SECRET is not configured");
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed.subarray(0, 32)]),
    format: "der",
    type: "pkcs8",
  });
}

function publicKeyFromSecret(secret: string) {
  const privateKey = privateKeyFromSecret(secret);
  const der = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, der.subarray(der.length - 32)]),
    format: "der",
    type: "spki",
  });
}

/** QQ callback validation response (opcode 13). */
export function signQQCallbackValidation(
  secret: string,
  eventTs: string,
  plainToken: string,
): string {
  return ed25519Sign(
    null,
    Buffer.from(`${eventTs}${plainToken}`, "utf8"),
    privateKeyFromSecret(secret),
  ).toString("hex");
}

/** Verify the exact timestamp + raw body bytes, before parsing or normalizing JSON. */
export function verifyQQCallbackSignature({
  secret,
  timestamp,
  signature,
  rawBody,
}: {
  secret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
}): boolean {
  try {
    if (!timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return false;
    const signatureBytes = Buffer.from(signature, "hex");
    if (signatureBytes.length !== 64 || (signatureBytes[63] & 224) !== 0) return false;
    return ed25519Verify(
      null,
      Buffer.concat([Buffer.from(timestamp, "utf8"), Buffer.from(rawBody, "utf8")]),
      publicKeyFromSecret(secret),
      signatureBytes,
    );
  } catch {
    return false;
  }
}

export function isFreshQQTimestamp(timestamp: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const value = Number(timestamp);
  return Number.isFinite(value) && Math.abs(nowSeconds - value) <= 300;
}

export function parseQQIncomingMessage(payload: QQCallbackPayload): QQIncomingMessage | null {
  if (payload.op !== 0 || !payload.d) return null;
  const isC2C = payload.t === "C2C_MESSAGE_CREATE";
  const isGroup = payload.t === "GROUP_AT_MESSAGE_CREATE";
  if (!isC2C && !isGroup) return null;
  const authorOpenId = payload.d.author?.user_openid;
  const targetOpenId = isC2C ? authorOpenId : payload.d.group_openid;
  const messageId = payload.d.id;
  if (
    typeof authorOpenId !== "string" || !authorOpenId ||
    typeof targetOpenId !== "string" || !targetOpenId ||
    typeof messageId !== "string" || !messageId
  ) return null;
  return {
    eventId: typeof payload.id === "string" && payload.id ? payload.id : messageId,
    messageId,
    authorOpenId,
    targetOpenId,
    kind: isC2C ? "c2c" : "group",
    content: typeof payload.d.content === "string" ? payload.d.content.trim() : "",
  };
}

/** Stable idempotency across QQ webhook retries, in the UUID format used by chat_turns. */
export function qqEventTurnId(eventId: string): string {
  const hex = createHash("sha256").update(`amara-qq:${eventId}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function parseAllowedQQOpenIds(value: string | undefined): Set<string> {
  return new Set((value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

export function splitQQReply(text: string, maxChunks = 4, chunkLength = 1500): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const characters = Array.from(normalized);
  const chunks: string[] = [];
  for (let offset = 0; offset < characters.length && chunks.length < maxChunks; offset += chunkLength) {
    chunks.push(characters.slice(offset, offset + chunkLength).join(""));
  }
  if (chunks.length === maxChunks && characters.length > maxChunks * chunkLength) {
    chunks[maxChunks - 1] = `${chunks[maxChunks - 1].slice(0, Math.max(0, chunkLength - 1))}…`;
  }
  return chunks;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

async function responseJSON(response: Response, operation: string) {
  const body: any = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.message === "string" ? body.message.slice(0, 160) : "unknown error";
    throw new Error(`${operation} failed (${response.status}): ${detail}`);
  }
  return body;
}

async function requestQQAccessToken(): Promise<string> {
  const appId = process.env.QQ_BOT_APP_ID;
  const clientSecret = process.env.QQ_BOT_APP_SECRET;
  if (!appId || !clientSecret) throw new Error("QQ bot credentials are not configured");
  const response = await fetch(`${QQ_API_BASE}/app/getAppAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, clientSecret }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = await responseJSON(response, "QQ access token request");
  const expiresIn = Number(body?.expires_in);
  if (typeof body?.access_token !== "string" || !body.access_token) {
    throw new Error("QQ access token response is invalid");
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
  return body.access_token;
}

async function qqAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 120_000) return cachedToken.value;
  if (!tokenRequest) {
    tokenRequest = requestQQAccessToken().finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

export async function sendQQText(message: QQIncomingMessage, text: string): Promise<void> {
  const chunks = splitQQReply(text, message.kind === "c2c" ? 4 : 5);
  if (chunks.length === 0) return;
  const token = await qqAccessToken();
  const path = message.kind === "c2c"
    ? `/v2/users/${encodeURIComponent(message.targetOpenId)}/messages`
    : `/v2/groups/${encodeURIComponent(message.targetOpenId)}/messages`;
  for (let index = 0; index < chunks.length; index += 1) {
    const response = await fetch(`${QQ_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `QQBot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: 0,
        content: chunks[index],
        msg_id: message.messageId,
        msg_seq: index + 1,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    await responseJSON(response, "QQ message send");
  }
}
