import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { deleteProfileMemory, PROFILE_MEMORY_PREFIX } from "@/lib/memory-records";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };
const MEMORY_SELECT = "id, companion_id, summary, importance, source_session_id, created_at, updated_at";

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const supabase = createRouteHandlerClient({ cookies });

  if (params.id.startsWith(PROFILE_MEMORY_PREFIX)) {
    const result = await deleteProfileMemory(supabase, user.id, params.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  }

  const { data: memory, error: readError } = await supabase
    .from("memory_summaries")
    .select(MEMORY_SELECT)
    .eq("id", params.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "读取记忆失败" }, { status: 500 });
  if (!memory) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

  const { data: companion, error: companionError } = await supabase
    .from("companions")
    .select("id")
    .eq("id", memory.companion_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (companionError) return NextResponse.json({ error: "校验记忆归属失败" }, { status: 500 });
  if (!companion) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

  const { error } = await supabase
    .from("memory_summaries")
    .delete()
    .eq("id", params.id)
    .eq("companion_id", memory.companion_id);
  if (error) return NextResponse.json({ error: "删除记忆失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
