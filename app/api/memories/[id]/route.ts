import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { embedText } from "@/lib/embedding";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };
const MEMORY_SELECT = "id, companion_id, summary, importance, source_session_id, created_at, updated_at";

async function getOwnedMemory(userId: string, memoryId: string) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: memory, error } = await supabase
    .from("memory_summaries")
    .select(MEMORY_SELECT)
    .eq("id", memoryId)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: "读取记忆失败" }, { status: 500 }) };
  if (!memory) return { error: NextResponse.json({ error: "记忆不存在" }, { status: 404 }) };

  const { data: companion, error: companionError } = await supabase
    .from("companions")
    .select("id")
    .eq("id", memory.companion_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (companionError) return { error: NextResponse.json({ error: "校验角色失败" }, { status: 500 }) };
  if (!companion) return { error: NextResponse.json({ error: "记忆不存在" }, { status: 404 }) };
  return { supabase, memory };
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: { summary?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求必须是 JSON" }, { status: 400 });
  }
  if (typeof body?.summary !== "string") {
    return NextResponse.json({ error: "summary 必须是字符串" }, { status: 400 });
  }
  const summary = body.summary.trim();
  if (!summary || summary.length > 4000) {
    return NextResponse.json({ error: "summary 长度必须为 1-4000 字符" }, { status: 400 });
  }

  const result = await getOwnedMemory(user.id, params.id);
  if (result.error) return result.error;
  // Edited text must not retain the old text's vector. If embeddings are
  // temporarily unavailable, null safely selects the non-semantic fallback.
  const embedding = await embedText(summary, 5000);
  const { data: memory, error } = await result.supabase!
    .from("memory_summaries")
    .update({ summary, embedding: embedding || null })
    .eq("id", params.id)
    .eq("companion_id", result.memory!.companion_id)
    .select(MEMORY_SELECT)
    .single();
  if (error) return NextResponse.json({ error: "更新记忆失败" }, { status: 500 });
  return NextResponse.json({ memory });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const result = await getOwnedMemory(user.id, params.id);
  if (result.error) return result.error;

  const { error } = await result.supabase!
    .from("memory_summaries")
    .delete()
    .eq("id", params.id)
    .eq("companion_id", result.memory!.companion_id);
  if (error) return NextResponse.json({ error: "删除记忆失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
