import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 获取当前用户的所有陪伴角色 + 每个角色的 profile / 记忆数
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { data: companions, error } = await supabase
    .from("companions")
    .select(`
      id,
      relationship_type,
      gender,
      companion_name,
      user_nickname,
      persona,
      relationship_stage,
      last_active_at,
      created_at,
      updated_at
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 拉取每个 companion 的 user_profile 和 memory_summaries 数量
  const ids = (companions || []).map((c: any) => c.id);
  let profiles: any[] = [];
  let summaries: any[] = [];
  if (ids.length > 0) {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("user_profiles").select("companion_id, profile, updated_at").in("companion_id", ids),
      supabase.from("memory_summaries").select("companion_id, id").in("companion_id", ids),
    ]);
    profiles = p || [];
    summaries = s || [];
  }

  const result = (companions || []).map((c: any) => {
    const prof = profiles.find((p: any) => p.companion_id === c.id);
    const memCount = summaries.filter((s: any) => s.companion_id === c.id).length;
    return {
      ...c,
      profile: prof?.profile || {},
      profile_updated_at: prof?.updated_at || null,
      memory_count: memCount,
    };
  });

  return NextResponse.json({ companions: result });
}

// 创建新的陪伴角色（一个用户终身只有一段关系，不可切换）
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });

  // 检查是否已有关系：一个用户终身只有一段关系
  const { count } = await supabase
    .from("companions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) {
    return NextResponse.json({ error: "你已经有了一段关系，无法创建新的" }, { status: 409 });
  }

  const body = await req.json();
  const { relationship_type, gender, companion_name, user_nickname } = body;

  if (!relationship_type || !["friend", "lover"].includes(relationship_type)) {
    return NextResponse.json({ error: "角色类型无效" }, { status: 400 });
  }

  // 恋人版统一叫 Amara；朋友版暂不取名（让对话自然出现）
  const autoName = relationship_type === "lover" ? "Amara" : null;

  const { data, error } = await supabase
    .from("companions")
    .insert({
      user_id: user.id,
      relationship_type,
      gender: gender || null,
      companion_name: autoName,
      user_nickname: user_nickname || null,
      persona: "gentle", // 默认过渡人格，后台 5-8 轮后自动锁定
      relationship_stage: 5,
      relationship_events: [],
      last_active_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 顺带建一份空 profile
  await supabase.from("user_profiles").insert({ companion_id: data.id, profile: {} });

  return NextResponse.json({ companion: data });
}
