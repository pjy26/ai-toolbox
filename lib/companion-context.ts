import OpenAI from "openai";
import { type PersonaType } from "@/lib/amara-persona";
import { buildLoverStaticPrompt, buildLoverStatePrompt } from "@/lib/amara-prompt";
import { semanticRecall } from "@/lib/memory-retrieval";
import { isMemoryEnabled } from "@/lib/user-settings";
import { dedupeMemoryEntries, isExpiredTransientMemory, isUserScopedMemoryText } from "@/lib/memory-reliability";
import {
  conversationTimeBlock,
  daysSinceLastChat,
  lastChatContext,
  outputLanguageBlock,
} from "@/lib/conversation-context";

export const LIVE_STATE_TTL_MS = 6 * 60 * 60 * 1000;
export const EMOTION_STATE_TTL_MS = 12 * 60 * 60 * 1000;

export interface CompanionRow {
  id: string;
  user_id: string;
  relationship_type: string;
  gender: string | null;
  companion_name: string | null;
  user_nickname: string | null;
  persona: PersonaType;
  persona_locked_at?: string | null;
  relationship_stage: number;
  stage_date?: string | null;
  stage_day_count?: number | null;
  emotion_state?: Record<string, any> | null;
  live_state?: { current_activity?: string; mood?: string; last_topic?: string } | null;
  last_active_at?: string | null;
}

interface ProfileRow {
  profile: Record<string, any> | null;
}

export interface ConversationMessage {
  role: string;
  content: string;
}

export function getFreshState<T extends Record<string, any>>(
  state: T | null | undefined,
  ttlMs: number,
  nowMs = Date.now(),
): T | null {
  if (!state) return null;
  const updatedAt = typeof state.updated_at === "string" ? Date.parse(state.updated_at) : NaN;
  if (!Number.isFinite(updatedAt) || nowMs - updatedAt > ttlMs) return null;
  return state;
}

const VETO_RULES: { pattern: RegExp; constraint: { zh: string; en: string } }[] = [
  { pattern: /睡眠|失眠|熬夜|睡不好|睡不着|sleep|insomnia/i, constraint: { zh: "避免提咖啡/浓茶/熬夜邀约/太刺激的活动，晚上主动提醒 TA 早点休息", en: "Avoid caffeine, late-night plans, and overstimulating activities; gently encourage rest." } },
  { pattern: /生病|感冒|发烧|咳嗽|嗓子疼|头疼|头痛|头晕|难受|sick|ill|fever|cough|headache|dizzy/i, constraint: { zh: "TA 身体不舒服——避免外出/运动/聚餐类邀约，多关心身体和休息", en: "They may be unwell; avoid outings, exercise, or parties and prioritize rest." } },
  { pattern: /胃痛|胃疼|胃不舒服|肠胃|stomach/i, constraint: { zh: "TA 胃不舒服——避免推荐辛辣、生冷、咖啡、酒", en: "Avoid suggesting spicy food, cold drinks, caffeine, or alcohol." } },
  { pattern: /生理期|月经|例假|姨妈|period|menstru/i, constraint: { zh: "TA 在生理期——避免冷饮、剧烈运动类邀约，多体贴照顾", en: "Be considerate and avoid pushing strenuous activity." } },
  { pattern: /受伤|扭伤|骨折|手术|住院|injur|sprain|fracture|surgery|hospital/i, constraint: { zh: "TA 有伤/在恢复期——避免运动、奔波类邀约", en: "They may be recovering; avoid exercise or tiring travel suggestions." } },
  { pattern: /过敏|allerg/i, constraint: { zh: "TA 有过敏——推荐吃的或活动前先想一层是否会触发", en: "Check for possible allergens before suggesting food or activities." } },
];

export function splitVetoMemories(memText: string, locale: "en" | "zh"): { vetoText: string; restText: string } {
  if (!memText) return { vetoText: "", restText: "" };
  const vetoLines: string[] = [];
  const restLines: string[] = [];
  const usedConstraints = new Set<string>();
  for (const line of memText.split("\n")) {
    const hit = VETO_RULES.find((rule) => rule.pattern.test(line));
    if (hit) {
      const constraint = hit.constraint[locale];
      const tail = usedConstraints.has(constraint) ? "" : ` — ${constraint}`;
      usedConstraints.add(constraint);
      vetoLines.push(`${locale === "en" ? "- Care note:" : "- 【注意】"}${line.replace(/^-\s*/, "")}${tail}`);
    } else {
      restLines.push(line);
    }
  }
  return { vetoText: vetoLines.join("\n"), restText: restLines.join("\n") };
}

function profileToText(profile: Record<string, any> | null, locale: "en" | "zh"): string {
  if (!profile || Object.keys(profile).length === 0) return "";
  const lines: string[] = [];
  const separator = locale === "en" ? "; " : "；";
  const labels = locale === "en"
    ? { basic: "Basic info", preferences: "Preferences", people: "Important people", ongoing: "Previously ongoing matters", personality: "Personality notes", other: "Other records" }
    : { basic: "基本信息", preferences: "偏好", people: "重要的人", ongoing: "正在经历的事", personality: "性格特点", other: "其他" };
  const basic = profile.basic_info;
  if (basic && typeof basic === "object") {
    const parts = Object.entries(basic).map(([key, value]) => `${key}: ${value}`).join(separator);
    if (parts) lines.push(`${locale === "en" ? "" : "【"}${labels.basic}${locale === "en" ? ":" : "】"}${parts}`);
  }
  if (profile.preferences && Object.keys(profile.preferences).length > 0) {
    const parts = Object.entries(profile.preferences).map(([key, value]) => `${key}: ${value}`).join(separator);
    if (parts) lines.push(`${locale === "en" ? "" : "【"}${labels.preferences}${locale === "en" ? ":" : "】"}${parts}`);
  }
  if (Array.isArray(profile.important_people) && profile.important_people.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.people}${locale === "en" ? ":" : "】"}${profile.important_people.map((person: any) => typeof person === "string" ? person : JSON.stringify(person)).join(separator)}`);
  }
  if (Array.isArray(profile.ongoing_matters) && profile.ongoing_matters.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.ongoing}${locale === "en" ? ":" : "】"}${profile.ongoing_matters.join(separator)}`);
  }
  if (profile.personality_notes) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.personality}${locale === "en" ? ":" : "】"}${profile.personality_notes}`);
  }
  if (Array.isArray(profile.key_facts) && profile.key_facts.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.other}${locale === "en" ? ":" : "】"}${profile.key_facts.join(separator)}`);
  }
  return lines.join("\n");
}

function eventsToText(events: { description: string; event_type?: string | null }[] | undefined): string {
  if (!events || events.length === 0) return "";
  return events.map((event) => `- ${event.description}`).join("\n");
}

export async function loadCompanionContext(
  supabase: any,
  companionId: string,
  userId: string,
  isMember: boolean,
  message: string,
  locale: "en" | "zh",
) {
  let profileText = "";
  let memText = "";
  let eventsText = "";
  const { data: userProfileRow } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", userId)
    .maybeSingle();
  const userGender: string = userProfileRow?.gender || "";
  const memoryEnabled = await isMemoryEnabled(supabase, userId);

  // The 30-message trial includes the same memory retrieval as membership.
  if (memoryEnabled) {
    const recall = await semanticRecall(supabase, companionId, message);
    const { data: profileRow } = await supabase
      .from("user_profiles").select("profile").eq("companion_id", companionId).maybeSingle();
    profileText = profileToText((profileRow as ProfileRow | null)?.profile || null, locale);

    if (recall) {
      memText = recall.memories.map((summary) => `- ${summary.summary}`).join("\n");
      eventsText = eventsToText(recall.events);
    } else {
      const { data: summaries, error: fallbackError } = await supabase
        .from("memory_summaries")
        .select("summary, importance, created_at, updated_at")
        .eq("companion_id", companionId)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(15);
      if (fallbackError) console.error("记忆降级检索失败:", fallbackError.message);
      memText = dedupeMemoryEntries(
        (summaries as any[] || []),
        (memory) => memory.summary,
        (memory) => !isUserScopedMemoryText(memory.summary) || isExpiredTransientMemory(memory.summary, memory.updated_at || memory.created_at),
      ).slice(0, 5).map((memory) => `- ${memory.summary}`).join("\n");
    }
  }

  const { vetoText, restText } = splitVetoMemories(memText, locale);
  return { userGender, profileText, memText: restText, eventsText, vetoText };
}

export function buildCompanionMessages({
  companion,
  userGender,
  profileText,
  memText,
  eventsText,
  vetoText,
  freshEmotionState,
  freshLiveState,
  message,
  dbHistory,
  clientHistory,
  locale,
  timezone,
  now = new Date(),
}: {
  companion: CompanionRow;
  userGender: string;
  profileText: string;
  memText: string;
  eventsText: string;
  vetoText: string;
  freshEmotionState: Record<string, any> | null;
  freshLiveState: Record<string, any> | null;
  message: string;
  dbHistory: ConversationMessage[];
  clientHistory: unknown;
  locale: "en" | "zh";
  timezone: string;
  now?: Date;
}): OpenAI.ChatCompletionMessageParam[] {
  const daysApart = daysSinceLastChat(companion.last_active_at, now, timezone);
  const currentTime = conversationTimeBlock(now, timezone, locale);
  const lastChat = lastChatContext(daysApart, locale);

  // Static prefix (identity, personality, style, safety) never changes between
  // turns, so it leads the message array as a stable, cacheable block.
  const staticPrompt = buildLoverStaticPrompt({
    locale,
    persona: companion.persona || "gentle",
    companion_gender: companion.gender || "不限",
    companion_name: companion.companion_name || "",
  });

  // Dynamic state (time, emotion, stage, care constraints, supplied records)
  // changes every turn and is injected right before the latest user message so
  // the model treats it as the current context. The hard output-language rule
  // also sits here, closest to the turn it must govern.
  const statePrompt = `${buildLoverStatePrompt({
    locale,
    persona: companion.persona || "gentle",
    companion_gender: companion.gender || "不限",
    nickname: companion.user_nickname || "",
    current_time: currentTime,
    last_chat_context: lastChat,
    relationship_stage: companion.relationship_stage || 5,
    emotion_state: freshEmotionState,
    user_profile: profileText,
    memory_summaries: memText,
    user_gender: userGender,
    live_state: freshLiveState,
    events_text: eventsText,
    veto_text: vetoText,
  })}\n\n${outputLanguageBlock(locale)}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "system", content: staticPrompt }];
  for (const item of dbHistory) {
    if (item.role === "user" || item.role === "assistant") {
      messages.push({ role: item.role, content: item.content });
    }
  }
  if (Array.isArray(clientHistory)) {
    const seen = new Set(dbHistory.map((item) => `${item.role}|${item.content}`));
    for (const item of clientHistory.slice(-10)) {
      if ((item?.role === "user" || item?.role === "assistant") && !seen.has(`${item.role}|${item.content}`)) {
        seen.add(`${item.role}|${item.content}`);
        messages.push({ role: item.role, content: item.content });
      }
    }
  }
  messages.push({ role: "system", content: statePrompt });
  messages.push({ role: "user", content: message });
  return messages;
}
