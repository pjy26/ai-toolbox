export const SUPPORT_EMAIL = "admin@amarapjy.xyz";
export const MEMBERSHIP_CURRENCY = "USD" as const;
export const WEEKLY_INTRO_PRICE = 0.99;

export type MembershipPlanId = "weekly" | "monthly" | "yearly";

export type MembershipPlan = {
  id: MembershipPlanId;
  name: string;
  price: number;
  regularPrice?: number;
  period: string;
  popular: boolean;
  hint: string;
  offer?: "new_user_weekly";
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "weekly",
    name: "Weekly",
    price: 1.99,
    period: "/ week",
    popular: false,
    hint: "A little more time",
  },
  {
    id: "monthly",
    name: "Monthly",
    price: 3.99,
    period: "/ month",
    popular: true,
    hint: "For ongoing connection",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 29.9,
    period: "/ year",
    popular: false,
    hint: "A year together",
  },
];

export function membershipPlans(weeklyIntroEligible: boolean): MembershipPlan[] {
  return MEMBERSHIP_PLANS.map((plan) =>
    plan.id === "weekly" && weeklyIntroEligible
      ? { ...plan, price: WEEKLY_INTRO_PRICE, regularPrice: plan.price, offer: "new_user_weekly" as const }
      : { ...plan },
  );
}

export function formatUsd(price: number) {
  return `$${price.toFixed(2)}`;
}

export function supportMailto(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
