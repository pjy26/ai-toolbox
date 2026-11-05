import type { MembershipTier } from "@/lib/membership-plans";

export type ConsoleFeature = "today" | "about" | "people" | "moments" | "dreams" | "letters" | "insights";

const PLUS_FEATURES = new Set<ConsoleFeature>(["moments", "dreams", "letters", "insights"]);

export function canAccessConsoleFeature(tier: MembershipTier, feature: ConsoleFeature) {
  return tier !== "free" || !PLUS_FEATURES.has(feature);
}

export function importantPeopleLimit(tier: MembershipTier) {
  return tier === "free" ? 1 : null;
}

export function limitImportantPeople<T>(people: T[], tier: MembershipTier) {
  const limit = importantPeopleLimit(tier);
  return limit === null ? people : people.slice(0, limit);
}

export const MEMBERSHIP_REQUIRED_CODE = "PLUS_REQUIRED";
