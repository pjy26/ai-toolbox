import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { canAccessConsoleFeature, MEMBERSHIP_REQUIRED_CODE } from "@/lib/access";
import { getActiveCompanionId } from "@/lib/companions";

export const dynamic = "force-dynamic";

type DimensionId = "continuity" | "personality" | "emotions" | "values" | "growth" | "uniqueness";

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("、");
  return "";
}

function dimension(id: DimensionId, evidence: string[]) {
  const clean = Array.from(new Set(evidence.map((item) => item.trim()).filter(Boolean))).slice(0, 4);
  return { id, evidence: clean, status: clean.length === 0 ? "waiting" : clean.length < 2 ? "forming" : "growing" };
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const membership = await getMembershipStatus(user.id);
  if (!canAccessConsoleFeature(membership.tier, "insights")) {
    return NextResponse.json({ error: "Plus membership required", code: MEMBERSHIP_REQUIRED_CODE }, { status: 403 });
  }

  const locale = new URL(req.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  const supabase = createRouteHandlerClient({ cookies });
  const activeCompanionId = await getActiveCompanionId(supabase, user.id);
  if (!activeCompanionId) return NextResponse.json({ companion: null });

  const [companionResult, profileResult, memoriesResult, eventsResult] = await Promise.all([
    supabase.from("companions").select("id, companion_name, persona, relationship_stage, created_at, updated_at, last_active_at").eq("id", activeCompanionId).eq("user_id", user.id).maybeSingle(),
    supabase.from("user_profiles").select("profile, updated_at").eq("companion_id", activeCompanionId).maybeSingle(),
    supabase.from("memory_summaries").select("id, summary, created_at, updated_at").eq("companion_id", activeCompanionId).order("updated_at", { ascending: false }).limit(200),
    supabase.from("relationship_events").select("id, description, occurred_at, created_at").eq("companion_id", activeCompanionId).order("occurred_at", { ascending: false }).limit(100),
  ]);
  const error = companionResult.error || profileResult.error || memoriesResult.error || eventsResult.error;
  if (error) return NextResponse.json({ error: "无法生成多维记忆分析" }, { status: 500 });
  if (!companionResult.data) return NextResponse.json({ companion: null });

  const companion = companionResult.data;
  const profile = profileResult.data?.profile && typeof profileResult.data.profile === "object" ? profileResult.data.profile : {};
  const memories = memoriesResult.data || [];
  const events = eventsResult.data || [];
  const summaries = memories.map((memory: any) => text(memory.summary)).filter(Boolean);
  const preferences = profile.preferences && typeof profile.preferences === "object" && !Array.isArray(profile.preferences)
    ? Object.entries(profile.preferences).map(([key, value]) => `${key}: ${text(value)}`)
    : [];
  const keyFacts = Array.isArray(profile.key_facts) ? profile.key_facts.map(text) : [];
  const ongoing = Array.isArray(profile.ongoing_matters) ? profile.ongoing_matters.map(text) : [];
  const emotionPattern = /我感到|我觉得|我很|我最近|开心|难过|焦虑|害怕|兴奋|疲惫|压力|孤独|\bI (?:feel|felt|am|was)\b|\bI'?m (?:happy|sad|anxious|afraid|excited|tired|overwhelmed|lonely)\b/i;
  const valuesPattern = /我在乎|我重视|我相信|对我来说.*重要|我看重|我愿意|我坚持|\bI (?:value|care about|believe|prioriti[sz]e)\b|\bmatters? to me\b/i;
  const eventCount = events.length;
  const continuityNote = locale === "zh"
    ? `${memories.length} 条记忆与 ${eventCount} 个共同瞬间，让之后的对话有所承接。`
    : `${memories.length} saved details and ${eventCount} shared moments give later conversations a thread to continue.`;
  const personaNames: Record<string, string> = locale === "zh"
    ? { gentle: "温柔", playful: "俏皮", quiet: "安静", clingy: "黏人" }
    : { gentle: "gentle", playful: "playful", quiet: "quiet", clingy: "affectionate" };
  const personaNote = locale === "zh"
    ? `这段关系里的 Amara 以“${personaNames[companion.persona] || personaNames.gentle}”为起点，并通过你们的共同互动形成独特节奏。`
    : `Amara begins with a ${personaNames[companion.persona] || personaNames.gentle} character here, then develops a rhythm through your shared interactions.`;
  const timestamps = [profileResult.data?.updated_at, companion.updated_at, companion.last_active_at, ...memories.slice(0, 1).map((item: any) => item.updated_at)]
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  const updatedAt = timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] || companion.created_at;
  const daysTogether = Math.max(1, Math.ceil((Date.now() - Date.parse(companion.created_at)) / 86_400_000));

  return NextResponse.json({
    companion: { id: companion.id, name: companion.companion_name || "Amara" },
    stats: { memoryCount: memories.length, momentCount: eventCount, daysTogether },
    updatedAt,
    dimensions: [
      dimension("continuity", [memories.length || eventCount ? continuityNote : "", ...keyFacts.slice(0, 2)]),
      dimension("personality", [text(profile.personality_notes), ...preferences, ...keyFacts].slice(0, 4)),
      dimension("emotions", summaries.filter((summary: string) => emotionPattern.test(summary))),
      dimension("values", summaries.filter((summary: string) => valuesPattern.test(summary))),
      dimension("growth", [...ongoing, ...summaries.slice(0, 2)]),
      dimension("uniqueness", [personaNote, ...events.slice(0, 2).map((event: any) => text(event.description))]),
    ],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
