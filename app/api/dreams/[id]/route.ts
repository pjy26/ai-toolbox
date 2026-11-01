import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { DREAM_SELECT } from "@/lib/dream";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

async function getOwnedDream(userId: string, dreamId: string) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: dream, error } = await supabase
    .from("dream_entries")
    .select(DREAM_SELECT)
    .eq("id", dreamId)
    .eq("status", "published")
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: "读取梦境失败" }, { status: 500 }) };
  if (!dream) return { error: NextResponse.json({ error: "梦境不存在" }, { status: 404 }) };

  const { data: companion, error: companionError } = await supabase
    .from("companions")
    .select("id")
    .eq("id", dream.companion_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (companionError) return { error: NextResponse.json({ error: "校验角色失败" }, { status: 500 }) };
  if (!companion) return { error: NextResponse.json({ error: "梦境不存在" }, { status: 404 }) };
  return { supabase, dream };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedDream(user.id, params.id);
  if (result.error) return result.error;
  return NextResponse.json({ dream: result.dream });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedDream(user.id, params.id);
  if (result.error) return result.error;

  const { error } = await result.supabase!
    .from("dream_entries")
    .update({ status: "deleted" })
    .eq("id", params.id)
    .eq("companion_id", result.dream!.companion_id)
    .eq("status", "published");
  if (error) return NextResponse.json({ error: "删除梦境失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
