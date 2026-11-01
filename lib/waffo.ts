import { TaxCategory, WaffoPancake } from "@waffo/pancake-ts";
import { MEMBERSHIP_PLANS, type MembershipPlanId } from "@/lib/membership-plans";

export type WaffoEnvironment = "test" | "prod";

export function waffoEnvironment(): WaffoEnvironment {
  return process.env.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";
}

export function waffoStoreId() {
  return process.env.WAFFO_STORE_ID || "STO_32qiQR8luEAIEpTCIfzLpF";
}

export function waffoProductId(planId: MembershipPlanId) {
  const value = process.env[`WAFFO_PRODUCT_${planId.toUpperCase()}`];
  if (!value || !value.startsWith("PROD_")) {
    throw new Error(`WAFFO_PRODUCT_${planId.toUpperCase()} is not configured`);
  }
  return value;
}

function privateKey() {
  if (process.env.WAFFO_PRIVATE_KEY) return process.env.WAFFO_PRIVATE_KEY;
  if (process.env.WAFFO_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.WAFFO_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  throw new Error("WAFFO_PRIVATE_KEY or WAFFO_PRIVATE_KEY_BASE64 is required");
}

let cachedClient: WaffoPancake | null = null;
let cachedEnvironment: WaffoEnvironment | null = null;

// Build-time route imports must not require secrets or instantiate the SDK.
export function getWaffoClient() {
  const environment = waffoEnvironment();
  if (!cachedClient || cachedEnvironment !== environment) {
    cachedClient = new WaffoPancake({
      merchantId: process.env.WAFFO_MERCHANT_ID || "MER_5wp2TUVw2KgGPxtaypSMoT",
      privateKey: privateKey(),
      environment,
    });
    cachedEnvironment = environment;
  }
  return cachedClient;
}

export function waffoPriceSnapshot(planId: MembershipPlanId, weeklyIntro: boolean) {
  const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error("Unknown membership plan");
  return {
    amount: plan.price.toFixed(2),
    taxCategory: TaxCategory.SaaS,
    ...(weeklyIntro ? { trialAmount: "0.99" } : {}),
  };
}

export function siteUrl(path: string) {
  // Trim invisible BOM/whitespace that can be introduced by dashboard pastes.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.amarapjy.xyz").trim();
  return new URL(path, origin).toString();
}
