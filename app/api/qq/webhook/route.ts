import { after } from "next/server";
import { handleQQAmaraMessage } from "@/lib/qq-amara";
import {
  isFreshQQTimestamp,
  parseQQIncomingMessage,
  sendQQText,
  signQQCallbackValidation,
  verifyQQCallbackSignature,
  type QQCallbackPayload,
} from "@/lib/qq-bot";

export const runtime = "nodejs";
export const maxDuration = 60;

function callbackAck() {
  return Response.json({ op: 12 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (rawBody.length > 128_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  let payload: QQCallbackPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const secret = process.env.QQ_BOT_APP_SECRET || "";
  if (!secret) return Response.json({ error: "QQ integration is not configured" }, { status: 503 });

  // QQ's initial URL validation uses a signature in the JSON response. Some
  // validation requests do not carry dispatch signature headers, so verify them
  // whenever present without requiring them for this non-message opcode.
  if (payload.op === 13) {
    const timestamp = req.headers.get("x-signature-timestamp") || "";
    const signature = req.headers.get("x-signature-ed25519") || "";
    if (signature && !verifyQQCallbackSignature({ secret, timestamp, signature, rawBody })) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    const plainToken = payload.d?.plain_token;
    const eventTs = payload.d?.event_ts;
    if (typeof plainToken !== "string" || typeof eventTs !== "string") {
      return Response.json({ error: "Invalid validation payload" }, { status: 400 });
    }
    return Response.json({
      plain_token: plainToken,
      signature: signQQCallbackValidation(secret, eventTs, plainToken),
    });
  }

  const timestamp = req.headers.get("x-signature-timestamp") || "";
  const signature = req.headers.get("x-signature-ed25519") || "";
  if (
    !isFreshQQTimestamp(timestamp) ||
    !verifyQQCallbackSignature({ secret, timestamp, signature, rawBody })
  ) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const message = parseQQIncomingMessage(payload);
  if (message) {
    after(async () => {
      try {
        await handleQQAmaraMessage(message);
      } catch (error) {
        console.error("[qq] Message handling failed", {
          kind: message.kind,
          eventId: message.eventId,
          error: error instanceof Error ? error.message : "unknown",
        });
        try {
          await sendQQText(message, "我这边暂时出了点状况，等一会儿再叫我好吗？");
        } catch {
          console.error("[qq] Failure notice could not be sent", { eventId: message.eventId });
        }
      }
    });
  }
  return callbackAck();
}
