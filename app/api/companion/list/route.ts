import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { chooseActiveCompanionId, normalizeCompanionGender } from "@/lib/companions";
import { recordProductEvent } from "@/lib/product-events";

// 获取当前用户的所有陪伴角色 + 每个角色的 profile / 记忆数
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const lightweight = new URL(req.url).searchParams.get("lightweight") === "1";
  const [companionsResult, settingsResult] = await Promise.all([
    supabase
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
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("user_settings").select("active_companion_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const { data: companions, error } = companionsResult;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const activeCompanionId = chooseActiveCompanionId(companions || [], settingsResult.data?.active_companion_id);

  // Lightweight reads return both profiles but no profile or memory rows.
  if (lightweight) return NextResponse.json({ companions: companions || [], activeCompanionId });

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

  return NextResponse.json({ companions: result, activeCompanionId });
}

// Create one of at most two fully independent profiles: female and male.
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();
  const { user_nickname } = body;
  const gender = normalizeCompanionGender(body.gender);
  // Amara is a romantic companion only; the friend variant has been removed.
  const relationship_type = "lover";

  const { data: existing, error: readError } = await supabase
    .from("companions")
    .select("id, gender")
    .eq("user_id", user.id);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if ((existing || []).some((companion) => normalizeCompanionGender(companion.gender) === gender)) {
    return NextResponse.json({ error: "This companion profile already exists.", code: "PROFILE_EXISTS" }, { status: 409 });
  }
  if ((existing || []).length >= 2) {
    return NextResponse.json({ error: "Only two independent companion profiles are supported.", code: "PROFILE_LIMIT" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("companions")
    .insert({
      user_id: user.id,
      relationship_type,
      gender,
      profile_key: gender,
      companion_name: "Amara",
      user_nickname: user_nickname || null,
      persona: "gentle",
      relationship_stage: 5,
      last_active_at: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("user_profiles").insert({ companion_id: data.id, profile: {} });
  const { error: activateError } = await supabase.from("user_settings").upsert(
    { user_id: user.id, active_companion_id: data.id },
    { onConflict: "user_id" },
  );
  if (activateError) return NextResponse.json({ error: "Profile created but could not be activated. Please run the latest migration." }, { status: 503 });

  await recordProductEvent(supabase, user.id, "companion_created", { companionId: data.id, details: { profile: gender } });
  return NextResponse.json({ companion: data, activeCompanionId: data.id });
}
