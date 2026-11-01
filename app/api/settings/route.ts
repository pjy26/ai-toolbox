import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  locale: "en",
  timezone: "UTC",
  dream_enabled: true,
  proactive_enabled: true,
  memory_enabled: true,
};

type Settings = typeof DEFAULT_SETTINGS;

function publicSettings(row: Partial<Settings> | null): Settings {
  return {
    locale: row?.locale || DEFAULT_SETTINGS.locale,
    timezone: row?.timezone || DEFAULT_SETTINGS.timezone,
    dream_enabled: row?.dream_enabled ?? DEFAULT_SETTINGS.dream_enabled,
    proactive_enabled: row?.proactive_enabled ?? DEFAULT_SETTINGS.proactive_enabled,
    memory_enabled: row?.memory_enabled ?? DEFAULT_SETTINGS.memory_enabled,
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from("user_settings")
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "读取设置失败" }, { status: 500 });
  return NextResponse.json({ settings: publicSettings(data) });
}

export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

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
  const { data: current, error: readError } = await supabase
    .from("user_settings")
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "读取设置失败" }, { status: 500 });

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, ...publicSettings(current), ...updates },
      { onConflict: "user_id" },
    )
    .select("locale, timezone, dream_enabled, proactive_enabled, memory_enabled")
    .single();
  if (error) return NextResponse.json({ error: "保存设置失败" }, { status: 500 });
  return NextResponse.json({ settings: publicSettings(data) });
}
