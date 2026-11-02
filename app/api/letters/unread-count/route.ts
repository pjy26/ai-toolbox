import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { count, error } = await supabase
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "published")
    .is("read_at", null);
  if (error) {
    console.warn("[letters] unread count unavailable", error.message);
    return NextResponse.json({ unreadCount: 0, unavailable: true });
  }
  return NextResponse.json({ unreadCount: count || 0, unavailable: false });
}
