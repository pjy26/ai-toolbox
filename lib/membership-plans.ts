export const SUPPORT_EMAIL = "admin@amarapjy.xyz";
export const MEMBERSHIP_CURRENCY = "USD" as const;
export const PLUS_TRIAL_PRICE = 0.99;
export const WEEKLY_INTRO_PRICE = PLUS_TRIAL_PRICE;

export type MembershipTier = "free" | "plus" | "premium";
export type CheckoutPlanId = "plus_trial" | "plus_monthly" | "plus_yearly" | "premium_monthly" | "premium_yearly";
export type LegacyMembershipPlanId = "weekly" | "monthly" | "yearly";
export type MembershipPlanId = CheckoutPlanId | LegacyMembershipPlanId;

export type MembershipPlan = {
  id: CheckoutPlanId;
  tier: Exclude<MembershipTier, "free">;
  name: string;
  price: number;
  regularPrice?: number;
  period: string;
  popular: boolean;
  hint: string;
  available: boolean;
  autoRenew: boolean;
  offer?: "new_user_plus_trial";
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "plus_trial",
    tier: "plus",
    name: "Plus · one-week experience",
    price: PLUS_TRIAL_PRICE,
    period: "/ one week",
    popular: false,
    hint: "One week of Plus, with no automatic renewal",
    available: true,
    autoRenew: false,
    offer: "new_user_plus_trial",
  },
  {
    id: "plus_monthly",
    tier: "plus",
    name: "Plus Monthly",
    price: 6.99,
    period: "/ month",
    popular: true,
    hint: "A relationship that keeps unfolding",
    available: true,
    autoRenew: true,
  },
  {
    id: "plus_yearly",
    tier: "plus",
    name: "Plus Yearly",
    price: 59.99,
    period: "/ year",
    popular: true,
    hint: "A year of growing together",
    available: true,
    autoRenew: true,
  },
  {
    id: "premium_monthly",
    tier: "premium",
    name: "Premium Monthly",
    price: 12.99,
    period: "/ month",
    popular: false,
    hint: "Deeper understanding, currently in development",
    available: false,
    autoRenew: true,
  },
  {
    id: "premium_yearly",
    tier: "premium",
    name: "Premium Yearly",
    price: 109.99,
    period: "/ year",
    popular: false,
    hint: "Deeper understanding, currently in development",
    available: false,
    autoRenew: true,
  },
];

export function membershipPlans(plusTrialEligible: boolean): MembershipPlan[] {
  return MEMBERSHIP_PLANS.map((plan) =>
    plan.id === "plus_trial"
      ? { ...plan, available: plusTrialEligible, offer: plusTrialEligible ? "new_user_plus_trial" as const : undefined }
      : { ...plan },
  );
}

export function membershipTier(membershipType: string | null | undefined): MembershipTier {
  if (membershipType === "premium_monthly" || membershipType === "premium_yearly") return "premium";
  if (membershipType && membershipType !== "free") return "plus";
  return "free";
}

export function isMembershipPlanId(value: unknown): value is MembershipPlanId {
  return value === "weekly" || value === "monthly" || value === "yearly" || MEMBERSHIP_PLANS.some((plan) => plan.id === value);
}

export function isCheckoutPlanId(value: unknown): value is CheckoutPlanId {
  return MEMBERSHIP_PLANS.some((plan) => plan.id === value);
}

export function formatUsd(price: number) {
  return `$${price.toFixed(2)}`;
}

export function supportMailto(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
