import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

function configuredValues(name: string) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(): Promise<
  { user: User; error: null } | { user: null; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const allowedIds = configuredValues("ADMIN_USER_IDS");
  const allowedEmails = configuredValues("ADMIN_EMAILS");
  const email = user.email?.trim().toLowerCase();
  const allowed = allowedIds.includes(user.id.toLowerCase()) || (!!email && allowedEmails.includes(email));

  if (!allowed) {
    return { user: null, error: NextResponse.json({ error: "Administrator access required" }, { status: 403 }) };
  }

  return { user, error: null };
}
