import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET: 列出某个 companion 的所有记忆（profile + summaries）
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const companion_id = searchParams.get("companion_id");
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  // 校验归属
  const { data: companion } = await supabase
    .from("companions")
    .select("id")
    .eq("id", companion_id)
    .eq("user_id", user.id)
    .single();
  if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });

  const [{ data: profileRow }, { data: summaries }] = await Promise.all([
    supabase.from("user_profiles").select("profile, updated_at").eq("companion_id", companion_id).maybeSingle(),
    supabase.from("memory_summaries").select("id, summary, importance, source_session_id, created_at, updated_at").eq("companion_id", companion_id).order("importance", { ascending: false }).order("updated_at", { ascending: false }),
  ]);

  return NextResponse.json({
    profile: profileRow?.profile || {},
    profile_updated_at: profileRow?.updated_at || null,
    summaries: summaries || [],
  });
}

// DELETE: 删除单条记忆摘要
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { memory_id, companion_id } = await req.json();
  if (!memory_id || !companion_id) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  // 校验归属（通过 companion 间接校验）
  const { data: companion } = await supabase
    .from("companions")
    .select("id")
    .eq("id", companion_id)
    .eq("user_id", user.id)
    .single();
  if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });

  const { error } = await supabase
    .from("memory_summaries")
    .delete()
    .eq("id", memory_id)
    .eq("companion_id", companion_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
