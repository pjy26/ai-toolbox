import type { Locale } from "@/lib/i18n";

/**
 * New events are stored as complete first-person monologues. This adapter only
 * repairs legacy third-person summaries; it never adds a new fact or feeling.
 */
export function amaraMomentText(value: string | null | undefined, nickname: string, locale: Locale): string {
  let text = (value || "").trim().replace(/^[“\"]+|[”\"]+$/g, "");
  if (!text) return "";
  const name = nickname.trim() || (locale === "zh" ? "你" : "you");

  if (locale === "zh") {
    text = text
      .replace(/陪伴角色|AI伴侣|AI 伴侣|assistant|Amara/gi, "我")
      .replace(/这位用户|该用户|用户|TA/g, name)
      .replaceAll(`${name}提到`, `${name}告诉我`)
      .replaceAll(`${name}主动说`, `${name}主动对我说`)
      .replace(/我\s*记得[，,]?\s*我记得/g, "我记得");
  } else {
    text = text
      .replace(/\b(the companion|companion character|the assistant|assistant|Amara)\b/gi, "I")
      .replace(/\b(the user|this user|user|TA)\b/gi, name)
      .replace(/\bI I\b/g, "I");
  }
  return text.trim();
}
