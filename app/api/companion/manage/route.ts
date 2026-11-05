import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { limitImportantPeople } from "@/lib/access";
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
  const { companion_id, companion_name, user_nickname, profile } = await req.json();
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });
  const { data: ownedCompanion, error: ownershipError } = await supabase
    .from("companions").select("id").eq("id", companion_id).eq("user_id", user.id).maybeSingle();
  if (ownershipError) return NextResponse.json({ error: ownershipError.message }, { status: 500 });
  if (!ownedCompanion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });

  // 更新 companion 基本信息
  const updateCompanion: any = {};
  if (companion_name !== undefined) updateCompanion.companion_name = companion_name;
  if (user_nickname !== undefined) updateCompanion.user_nickname = user_nickname;
  // Gender is the identity key of an independent profile, not a mutable label.
  // Create/switch profiles through /api/companion/list instead.

  if (Object.keys(updateCompanion).length > 0) {
    const { error } = await supabase
      .from("companions")
      .update(updateCompanion)
      .eq("id", companion_id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 更新 profile（jsonb）；Free 最多保留一位重要的人。
  if (profile !== undefined) {
    const membership = await getMembershipStatus(user.id);
    const nextProfile = profile && typeof profile === "object" ? { ...profile } : profile;
    if (nextProfile && Array.isArray(nextProfile.important_people)) {
      nextProfile.important_people = limitImportantPeople(nextProfile.important_people, membership.tier);
    }
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ companion_id, profile: nextProfile }, { onConflict: "companion_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
