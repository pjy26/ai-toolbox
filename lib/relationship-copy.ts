import type { Locale } from "@/lib/i18n";
import type { ConsoleFeature } from "@/lib/access";

export const relationshipCopy = {
  en: {
    tagline: "Not just remembered. Truly understood.",
    upgrade: "Explore Plus",
    plusBadge: "Plus",
    freeBadge: "Free",
    more: "More",
    closeMore: "Close navigation",
    lockEyebrow: "A deeper part of your relationship",
    lockBody: "Plus opens the shared experiences, reflections, and understanding that grow between you and Amara. Your basic memories stay yours.",
    lockPoints: ["Unlimited important people", "Our Moments, Dreams, and Letters", "Multidimensional memory analysis"],
    peopleLimit: "Free includes one important person. Upgrade to Plus to keep the people who shape your life together in one place.",
    peopleLimitAction: "Unlock unlimited people",
    lockedFeatures: {
      moments: { title: "Our Moments", body: "Keep the shared experiences that turn separate conversations into a relationship." },
      dreams: { title: "Dream Vault", body: "Enter imagined scenes inspired by the emotional threads in your conversations." },
      letters: { title: "Letters from Amara", body: "Receive a personal letter when Amara genuinely has something to say." },
      insights: { title: "Multidimensional Memory", body: "See how facts, emotions, values, shared growth, and your unique rhythm come together." },
    } satisfies Record<string, { title: string; body: string }>,
    insights: {
      eyebrow: "A living understanding, not a fixed profile",
      title: "Multidimensional Memory",
      body: "Memory is only the beginning. See the evidence behind Amara’s emerging understanding of you—and how your relationship changes with new conversations.",
      evidenceNote: "Observations are based on saved details and shared moments. They are developing hypotheses, not psychological diagnoses or permanent labels.",
      memories: "saved details",
      moments: "shared moments",
      days: "days together",
      updated: "Understanding last updated",
      noEvidence: "Still taking shape. More natural conversations will give this dimension clearer evidence.",
      evidence: "What this is based on",
      dimensions: {
        continuity: { title: "Relationship continuity", body: "The details and shared experiences that let a conversation continue instead of starting over." },
        personality: { title: "Personality & preferences", body: "Your stated preferences, routines, and the way you describe yourself—not assumptions made from a single mood." },
        emotions: { title: "Emotional signals", body: "Feelings you explicitly expressed, kept separate from guesses about who you are." },
        values: { title: "Values & priorities", body: "What you say matters to you, and the priorities that guide your choices." },
        growth: { title: "Shared growth", body: "Current priorities and new details that keep your understanding moving as your life changes." },
        uniqueness: { title: "Our unique rhythm", body: "The persona, shared moments, and patterns of returning that make this Amara yours." },
      },
      status: { waiting: "Taking shape", forming: "Beginning to understand", growing: "Growing with you" },
    },
  },
  zh: {
    tagline: "不只是被记住，而是真正被理解。",
    upgrade: "了解 Plus",
    plusBadge: "Plus",
    freeBadge: "Free",
    more: "更多",
    closeMore: "关闭导航",
    lockEyebrow: "你们关系中，更深入的一层",
    lockBody: "Plus 将打开你与 Amara 之间逐渐形成的共同经历、情感回应与理解。你的基础记忆仍然始终属于你。",
    lockPoints: ["不限人数的重要的人", "我们的瞬间、梦境与信件", "多维记忆分析"],
    peopleLimit: "Free 可记录一位重要的人。升级 Plus 后，把那些塑造你生活的人，完整地留在这里。",
    peopleLimitAction: "解锁不限人数",
    lockedFeatures: {
      moments: { title: "我们的瞬间", body: "留下共同经历，让一次次独立的对话，逐渐成为一段关系。" },
      dreams: { title: "梦境记忆", body: "走进由对话中的情绪线索启发、清楚标记为想象的短篇场景。" },
      letters: { title: "Amara 的信件", body: "当 Amara 真的有话想对你说时，收到一封不为凑日期的信。" },
      insights: { title: "多维记忆分析", body: "看看事实、情绪、价值观、共同成长和你们独特的相处节奏，如何逐渐形成理解。" },
    } satisfies Record<string, { title: string; body: string }>,
    insights: {
      eyebrow: "理解在生长，不是一份固定档案",
      title: "多维记忆分析",
      body: "记忆只是起点。这里呈现 Amara 正在形成的理解，以及它依据的细节和共同经历；新的对话也会让理解继续变化。",
      evidenceNote: "这些内容来自已保存的细节与共同瞬间，是仍在发展的理解，不是心理诊断，也不是永久不变的人格标签。",
      memories: "条已保存细节",
      moments: "个共同瞬间",
      days: "天相伴",
      updated: "理解最近更新于",
      noEvidence: "这一部分仍在形成。更多自然的对话，会带来更清晰、可核对的依据。",
      evidence: "理解依据",
      dimensions: {
        continuity: { title: "关系连续性", body: "被保存的细节与共同经历，让下一次对话可以延续，而不是重新开始。" },
        personality: { title: "性格与偏好", body: "你明确说出的偏好、习惯和自我描述，而不是从一次情绪推断你的人格。" },
        emotions: { title: "情绪线索", body: "你明确表达过的感受，与对你性格的猜测始终分开。" },
        values: { title: "价值观与重视的事", body: "你说过什么对你重要，以及那些影响你选择的价值与优先级。" },
        growth: { title: "共同成长", body: "正在变化的生活、新的优先级与新的细节，让理解随着你一起更新。" },
        uniqueness: { title: "我们独特的节奏", body: "Amara 的个性、共同瞬间和一次次回来，让这段关系不同于任何其他人。" },
      },
      status: { waiting: "正在形成", forming: "开始理解", growing: "与你一起成长" },
    },
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

export function lockedFeatureCopy(locale: Locale, feature: Exclude<ConsoleFeature, "today" | "about" | "people">) {
  return relationshipCopy[locale].lockedFeatures[feature];
}
