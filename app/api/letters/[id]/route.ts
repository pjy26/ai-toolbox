import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { canAccessConsoleFeature, MEMBERSHIP_REQUIRED_CODE } from "@/lib/access";
import { LETTER_DETAIL_SELECT } from "@/lib/letter";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };
const LETTER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getOwnedLetter(userId: string, letterId: string) {
  const membership = await getMembershipStatus(userId);
  if (!canAccessConsoleFeature(membership.tier, "letters")) {
    return { error: NextResponse.json({ error: "Plus membership required", code: MEMBERSHIP_REQUIRED_CODE }, { status: 403 }) };
  }
  if (!LETTER_ID.test(letterId)) return { error: NextResponse.json({ error: "信件不存在" }, { status: 404 }) };
  const supabase = createRouteHandlerClient({ cookies });
  const { data: letter, error } = await supabase
    .from("letters")
    .select(LETTER_DETAIL_SELECT)
    .eq("id", letterId)
    .eq("user_id", userId)
    .eq("status", "published")
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: "读取信件失败" }, { status: 500 }) };
  if (!letter) return { error: NextResponse.json({ error: "信件不存在" }, { status: 404 }) };
  return { supabase, letter };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedLetter(user.id, params.id);
  if (result.error) return result.error;
  return NextResponse.json({ letter: result.letter });
}

export async function PATCH(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedLetter(user.id, params.id);
  if (result.error) return result.error;
  if (result.letter!.read_at) return NextResponse.json({ letter: result.letter });

  const readAt = new Date().toISOString();
  const { data: updated, error } = await result.supabase!
    .from("letters")
    .update({ read_at: readAt })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("status", "published")
    .is("read_at", null)
    .select(LETTER_DETAIL_SELECT)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "标记已读失败" }, { status: 500 });
  if (updated) return NextResponse.json({ letter: updated });

  // A concurrent open may have won the read update; return the current owned row.
  const refreshed = await getOwnedLetter(user.id, params.id);
  if (refreshed.error) return refreshed.error;
  return NextResponse.json({ letter: refreshed.letter });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedLetter(user.id, params.id);
  if (result.error) return result.error;

  const { error } = await result.supabase!
    .from("letters")
    .update({ status: "deleted" })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("status", "published");
  if (error) return NextResponse.json({ error: "删除信件失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
