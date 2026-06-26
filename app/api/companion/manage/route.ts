import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 删除陪伴角色（级联删除所有记忆）
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { companion_id } = await req.json();
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  const { error } = await supabase
    .from("companions")
    .delete()
    .eq("id", companion_id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 更新陪伴角色配置 / profile
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { companion_id, companion_name, user_nickname, gender, profile } = await req.json();
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  // 更新 companion 基本信息
  const updateCompanion: any = {};
  if (companion_name !== undefined) updateCompanion.companion_name = companion_name;
  if (user_nickname !== undefined) updateCompanion.user_nickname = user_nickname;
  if (gender !== undefined) updateCompanion.gender = gender;

  if (Object.keys(updateCompanion).length > 0) {
    const { error } = await supabase
      .from("companions")
      .update(updateCompanion)
      .eq("id", companion_id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 更新 profile（jsonb）
  if (profile !== undefined) {
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ companion_id, profile }, { onConflict: "companion_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
