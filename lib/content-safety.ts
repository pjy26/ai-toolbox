import { ScanSemanticMode } from "@waffo/pancake-ts";
import { getWaffoClient } from "@/lib/waffo";

export type SafetyLocale = "en" | "zh";

/** Only an explicit allow may continue. Missing keys, limits, review, block and outages fail closed. */
export async function scanWaffoContent(text: string, locale: SafetyLocale, stage: "input" | "output" | "dream") {
  if (!text.trim() || text.length > 10000) return null;
  try {
    const verdict = await getWaffoClient().contentSafety.scanPrompt({
      prompt: text,
      locale,
      semantic: ScanSemanticMode.Enforce,
    });
    console.info("Waffo content safety verdict", {
      stage,
      requestId: verdict.requestId,
      action: verdict.action,
      reasonCode: verdict.reasonCode,
      categories: verdict.matchedCategories,
    });
    return verdict.action === "allow" ? verdict : null;
  } catch (error) {
    console.error("Waffo content safety unavailable", { stage, message: error instanceof Error ? error.message : "Unknown error" });
    return null;
  }
}

export function contentSafetyMessage(locale: SafetyLocale, stage: "input" | "output") {
  if (locale === "zh") {
    return stage === "input"
      ? "这条消息暂时无法处理，请调整内容后重试。"
      : "这次回复未通过安全检查，请换个话题再试。";
  }
  return stage === "input"
    ? "This message can’t be processed. Please rephrase it and try again."
    : "This response didn’t pass the safety check. Please try a different topic.";
}
