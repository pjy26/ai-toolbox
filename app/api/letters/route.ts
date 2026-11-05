import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { canAccessConsoleFeature, MEMBERSHIP_REQUIRED_CODE } from "@/lib/access";
import { LETTER_LIST_SELECT } from "@/lib/letter";
import { getActiveCompanionId } from "@/lib/companions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const membership = await getMembershipStatus(user.id);
  if (!canAccessConsoleFeature(membership.tier, "letters")) {
    return NextResponse.json({ error: "Plus membership required", code: MEMBERSHIP_REQUIRED_CODE }, { status: 403 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const activeCompanionId = await getActiveCompanionId(supabase, user.id);
  if (!activeCompanionId) return NextResponse.json({ letters: [], unavailable: false });
  const { data: letters, error } = await supabase
    .from("letters")
    .select(LETTER_LIST_SELECT)
    .eq("user_id", user.id)
    .eq("companion_id", activeCompanionId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[letters] storage unavailable", error.message);
    return NextResponse.json({ letters: [], unavailable: true });
  }
  return NextResponse.json({ letters: letters || [], unavailable: false });
}
