import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  locale: "en",
  timezone: "UTC",
  dream_enabled: true,
  proactive_enabled: true,
  memory_enabled: true,
  active_companion_id: null as string | null,
};

type Settings = typeof DEFAULT_SETTINGS;

function publicSettings(row: Partial<Settings> | null): Settings {
  return {
    locale: row?.locale || DEFAULT_SETTINGS.locale,
    timezone: row?.timezone || DEFAULT_SETTINGS.timezone,
    dream_enabled: row?.dream_enabled ?? DEFAULT_SETTINGS.dream_enabled,
    proactive_enabled: row?.proactive_enabled ?? DEFAULT_SETTINGS.proactive_enabled,
    memory_enabled: row?.memory_enabled ?? DEFAULT_SETTINGS.memory_enabled,
    active_companion_id: row?.active_companion_id || null,
  };
}

function settingsForTier(row: Partial<Settings> | null, isFree: boolean): Settings {
  const settings = publicSettings(row);
  return { ...settings, dream_enabled: isFree ? false : settings.dream_enabled };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const membership = await getMembershipStatus(user.id);
  const isFree = membership.tier === "free";
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from("user_settings")
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled, active_companion_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // Keep the settings surface usable while an older database has no settings
  // table yet. PATCH remains explicit about persistence failures.
  if (error) {
    console.warn("[settings] read unavailable; returning compatible defaults", error.message);
    return NextResponse.json({ settings: settingsForTier(null, isFree), persistent: false });
  }
  return NextResponse.json({ settings: settingsForTier(data, isFree), persistent: true });
}

export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const membership = await getMembershipStatus(user.id);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求必须是 JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const updates: Partial<Settings> = {};
  if (body.locale !== undefined) {
    if (typeof body.locale !== "string" || body.locale.length > 35) {
      return NextResponse.json({ error: "locale 无效" }, { status: 400 });
    }
    try {
      updates.locale = Intl.getCanonicalLocales(body.locale)[0];
    } catch {
      return NextResponse.json({ error: "locale 无效" }, { status: 400 });
    }
  }
  if (body.timezone !== undefined) {
    if (!isValidTimeZone(body.timezone)) {
      return NextResponse.json({ error: "timezone 必须是有效 IANA 时区" }, { status: 400 });
    }
    updates.timezone = body.timezone;
  }
  if (membership.tier === "free" && body.dream_enabled === true) {
    return NextResponse.json({ error: "梦境记忆是 Plus 功能，升级后即可使用。", code: "PLUS_REQUIRED" }, { status: 403 });
  }
  for (const key of ["dream_enabled", "proactive_enabled", "memory_enabled"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") {
        return NextResponse.json({ error: `${key} 必须是布尔值` }, { status: 400 });
      }
      updates[key] = body[key];
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "没有可更新的设置" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  if (body.active_companion_id !== undefined) {
    if (body.active_companion_id !== null && typeof body.active_companion_id !== "string") {
      return NextResponse.json({ error: "active_companion_id 无效" }, { status: 400 });
    }
    if (typeof body.active_companion_id === "string") {
      const { data: owned, error: ownedError } = await supabase
        .from("companions")
        .select("id")
        .eq("id", body.active_companion_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (ownedError) return NextResponse.json({ error: "验证陪伴档案失败" }, { status: 500 });
      if (!owned) return NextResponse.json({ error: "陪伴档案不存在" }, { status: 404 });
    }
    updates.active_companion_id = body.active_companion_id;
  }

  const { data: current, error: readError } = await supabase
    .from("user_settings")
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled, active_companion_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "读取设置失败" }, { status: 500 });

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, ...publicSettings(current), ...updates },
      { onConflict: "user_id" },
    )
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled, active_companion_id")
    .single();
  if (error) return NextResponse.json({ error: "保存设置失败" }, { status: 500 });
  return NextResponse.json({ settings: publicSettings(data) });
}
