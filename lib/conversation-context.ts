import { getLocalDate, getZonedParts, normalizeTimeZone } from "@/lib/timezone";

export type ConversationLocale = "en" | "zh";

export function normalizeConversationLocale(value: unknown): ConversationLocale {
  return typeof value === "string" && value.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** Calendar-day distance in the user's timezone, rather than a rolling 24-hour floor. */
export function daysSinceLastChat(
  lastActiveAt: string | null | undefined,
  now = new Date(),
  timezone = "UTC",
): number {
  if (!lastActiveAt) return -1;
  const lastActive = new Date(lastActiveAt);
  const lastActiveMs = lastActive.getTime();
  const nowMs = now.getTime();
  // 无效或来自未来的时间戳不能伪装成“今天刚聊过”；交给调用方走无可靠记录文案。
  if (!Number.isFinite(lastActiveMs) || !Number.isFinite(nowMs) || lastActiveMs > nowMs) return -1;
  const zone = normalizeTimeZone(timezone);
  const today = getLocalDate(now, zone);
  const lastDay = getLocalDate(lastActive, zone);
  const distance = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, distance);
}

export function conversationTimeBlock(
  now: Date,
  timezone: string,
  locale: ConversationLocale,
): string {
  const zone = normalizeTimeZone(timezone);
  const parts = getZonedParts(now, zone);
  const date = getLocalDate(now, zone);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  if (locale === "zh") {
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `现在的完整日期和时间是：${date} ${days[weekday]} ${hh}:${mm}（用户本地时区 ${zone}）。生成回复时必须以这个日期为准。`;
  }
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `Current local date and time: ${date}, ${days[weekday]}, ${hh}:${mm} (user timezone: ${zone}). Always use this date as the temporal reference.`;
}

export function lastChatContext(days: number, locale: ConversationLocale): string {
  if (locale === "zh") {
    if (days < 0) return "这是第一次对话，没有可信的上次聊天记录。";
    if (days === 0) return "上次聊天就是今天。严禁说 TA 好几天没来、好久不见或很久没聊。";
    if (days === 1) return "上次聊天是昨天。可以自然延续昨天的话题，严禁说 TA 好几天没来、好久不见或很久没聊。";
    return `上次聊天距今天正好 ${days} 个本地自然日。只有这里明确大于等于 2 天时，才可以表达几天没见的想念；不要夸大天数。`;
  }
  if (days < 0) return "This is the first conversation; there is no reliable previous chat timestamp.";
  if (days === 0) return "The last conversation was earlier today. Never say that the user has been away for days or that it has been a long time.";
  if (days === 1) return "The last conversation was yesterday. You may continue yesterday’s thread naturally, but never say the user has been away for days or that it has been a long time.";
  return `The last conversation was exactly ${days} local calendar days ago. Only mention missing the user over several days when this value is at least 2, and never exaggerate the gap.`;
}

export function outputLanguageBlock(locale: ConversationLocale): string {
  return locale === "zh"
    ? "# 输出语言（硬约束）\n无论下方提示词、记忆或历史消息使用什么语言，这一轮都必须只用自然、口语化的简体中文回复。"
    : "# Output language (hard requirement)\nRegardless of the language used in these instructions, memories, or earlier messages, respond only in natural, conversational English. Do not switch into Chinese.";
}
