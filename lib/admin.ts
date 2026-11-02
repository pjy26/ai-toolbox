import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "amara_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

type AdminIdentity = {
  id: string;
  email?: string | null;
};

type AdminSession = {
  sub: string;
  email: string | null;
  exp: number;
};

function configuredValues(name: string) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdmin(user: AdminIdentity) {
  const allowedIds = configuredValues("ADMIN_USER_IDS");
  const allowedEmails = configuredValues("ADMIN_EMAILS");
  const email = user.email?.trim().toLowerCase();
  return allowedIds.includes(user.id.toLowerCase()) || (!!email && allowedEmails.includes(email));
}

function sessionSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin sessions");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createAdminSessionToken(user: AdminIdentity) {
  const payload: AdminSession = {
    sub: user.id,
    email: user.email || null,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AdminSession;
    if (!session.sub || typeof session.exp !== "number" || session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!isAllowedAdmin({ id: session.sub, email: session.email })) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<
  { user: { id: string; email: string | null }; error: null } | { user: null; error: NextResponse }
> {
  const cookieStore = cookies();
  const session = readAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return { user: null, error: NextResponse.json({ error: "Administrator sign-in required" }, { status: 401 }) };
  }

  return { user: { id: session.sub, email: session.email }, error: null };
}
