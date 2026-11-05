import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { getActiveCompanionId } from "@/lib/companions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const membership = await getMembershipStatus(user.id);
  if (membership.tier === "free") return NextResponse.json({ unreadCount: 0, unavailable: false });

  const supabase = createRouteHandlerClient({ cookies });
  const activeCompanionId = await getActiveCompanionId(supabase, user.id);
  if (!activeCompanionId) return NextResponse.json({ unreadCount: 0, unavailable: false });
  const { count, error } = await supabase
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("companion_id", activeCompanionId)
    .eq("status", "published")
    .is("read_at", null);
  if (error) {
    console.warn("[letters] unread count unavailable", error.message);
    return NextResponse.json({ unreadCount: 0, unavailable: true });
  }
  return NextResponse.json({ unreadCount: count || 0, unavailable: false });
}
