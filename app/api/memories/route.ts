import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MEMORY_SELECT = "id, companion_id, summary, importance, source_session_id, created_at, updated_at";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const companionId = new URL(req.url).searchParams.get("companion_id");
  const supabase = createRouteHandlerClient({ cookies });

  let companionIds: string[];
  if (companionId) {
    const { data: companion, error } = await supabase
      .from("companions")
      .select("id")
      .eq("id", companionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "读取角色失败" }, { status: 500 });
    if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    companionIds = [companion.id];
  } else {
    const { data: companions, error } = await supabase
      .from("companions")
      .select("id")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "读取角色失败" }, { status: 500 });
    companionIds = (companions || []).map((companion) => companion.id);
  }

  if (companionIds.length === 0) return NextResponse.json({ memories: [] });
  const { data: memories, error } = await supabase
    .from("memory_summaries")
    .select(MEMORY_SELECT)
    .in("companion_id", companionIds)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "读取记忆失败" }, { status: 500 });
  return NextResponse.json({ memories: memories || [] });
}
