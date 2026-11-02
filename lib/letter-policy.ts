import type { PersonaLocale } from "@/lib/amara-persona";

export type LetterMilestoneConfig = {
  key: string;
  minimumStage: number;
  minimumUserMessages: number;
  minimumSubstantiveUserMessages: number;
  minimumContextRecords: number;
};

/**
 * Conservative internal defaults, not a sending schedule. Product can tune these
 * later without changing table or API contracts. Only one new milestone is
 * considered per automatic candidate run, and automatic runs are env-gated.
 */
export const LETTER_MILESTONES: readonly LetterMilestoneConfig[] = [
  { key: "getting-acquainted", minimumStage: 12, minimumUserMessages: 4, minimumSubstantiveUserMessages: 2, minimumContextRecords: 0 },
  { key: "growing-familiar", minimumStage: 30, minimumUserMessages: 10, minimumSubstantiveUserMessages: 4, minimumContextRecords: 1 },
  { key: "shared-story", minimumStage: 55, minimumUserMessages: 18, minimumSubstantiveUserMessages: 8, minimumContextRecords: 2 },
  { key: "deepening-bond", minimumStage: 80, minimumUserMessages: 30, minimumSubstantiveUserMessages: 12, minimumContextRecords: 3 },
] as const;

export type LetterMaterial = {
  userMessageCount: number;
  substantiveUserMessageCount: number;
  contextRecordCount: number;
};

export type LetterMaterialGate =
  | { eligible: true }
  | {
      eligible: false;
      reason: "insufficient_stage" | "insufficient_user_messages" | "insufficient_substantive_material" | "insufficient_context";
    };

export function getLetterMilestone(key: string): LetterMilestoneConfig | undefined {
  return LETTER_MILESTONES.find((milestone) => milestone.key === key);
}

export function isSubstantiveUserMessage(content: string): boolean {
  const text = content.trim();
  if (!/[A-Za-z0-9\u3400-\u9fff]/.test(text)) return false;
  return Array.from(text).length >= 8;
}

export function summarizeLetterMaterial(
  messages: Array<{ role: string; content: string }>,
  memoryCount: number,
  eventCount: number,
): LetterMaterial {
  const userMessages = messages.filter((message) => message.role === "user" && message.content.trim());
  return {
    userMessageCount: userMessages.length,
    substantiveUserMessageCount: userMessages.filter((message) => isSubstantiveUserMessage(message.content)).length,
    contextRecordCount: Math.max(0, memoryCount) + Math.max(0, eventCount),
  };
}

export function evaluateLetterMaterial(
  milestone: LetterMilestoneConfig,
  relationshipStage: number,
  material: LetterMaterial,
): LetterMaterialGate {
  if (relationshipStage < milestone.minimumStage) return { eligible: false, reason: "insufficient_stage" };
  if (material.userMessageCount < milestone.minimumUserMessages) return { eligible: false, reason: "insufficient_user_messages" };
  if (material.substantiveUserMessageCount < milestone.minimumSubstantiveUserMessages) {
    return { eligible: false, reason: "insufficient_substantive_material" };
  }
  if (material.contextRecordCount < milestone.minimumContextRecords) {
    return { eligible: false, reason: "insufficient_context" };
  }
  return { eligible: true };
}

/** Existing keys include deleted rows, because soft deletion never reopens a milestone. */
export function selectNextLetterMilestone(
  relationshipStage: number,
  material: LetterMaterial,
  existingMilestoneKeys: ReadonlySet<string>,
): LetterMilestoneConfig | null {
  for (const milestone of LETTER_MILESTONES) {
    if (existingMilestoneKeys.has(milestone.key)) continue;
    return evaluateLetterMaterial(milestone, relationshipStage, material).eligible ? milestone : null;
  }
  return null;
}

export function normalizeLetterLocale(locale: string | null | undefined): PersonaLocale {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function hasActiveMembership(profile: {
  membership_type?: string | null;
  membership_expires_at?: string | null;
  manual_membership_type?: string | null;
  manual_membership_expires_at?: string | null;
} | null, now: Date): boolean {
  if (!profile) return false;
  const paidExpiry = profile.membership_expires_at ? Date.parse(profile.membership_expires_at) : Number.NaN;
  const manualExpiry = profile.manual_membership_expires_at ? Date.parse(profile.manual_membership_expires_at) : Number.NaN;
  const paidActive = Boolean(profile.membership_type && profile.membership_type !== "free" && paidExpiry > now.getTime());
  const manualActive = Boolean(profile.manual_membership_type && manualExpiry > now.getTime());
  return paidActive || manualActive;
}
