import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { MEMBERSHIP_PLANS, WEEKLY_INTRO_PRICE, type MembershipPlanId } from "@/lib/membership-plans";
import { generateOrderNo } from "@/lib/utils";
import { getWaffoClient, siteUrl, waffoPriceSnapshot, waffoProductId } from "@/lib/waffo";

export const runtime = "nodejs";

const PLAN_IDS = new Set<MembershipPlanId>(["weekly", "monthly", "yearly"]);

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { planId?: unknown; locale?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.planId !== "string" || !PLAN_IDS.has(body.planId as MembershipPlanId)) {
    return NextResponse.json({ error: "Unknown membership plan." }, { status: 400 });
  }
  const planId = body.planId as MembershipPlanId;
  const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId)!;
  const locale = body.locale === "zh" ? "zh-Hans" : "en";
  const supabase = createRouteHandlerClient({ cookies });

  const { data: currentSubscriptions, error: subscriptionError } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "waffo")
    .in("subscription_status", ["active", "canceling", "past_due"])
    .limit(1);
  if (subscriptionError) {
    console.error("Unable to verify current Waffo subscription", subscriptionError.message);
    return NextResponse.json({ error: "Membership status is temporarily unavailable." }, { status: 503 });
  }
  if (currentSubscriptions?.length) {
    try {
      const { portalUrl } = await getWaffoClient().auth.createCustomerPortalLink({
        storeId: process.env.WAFFO_STORE_ID || "STO_32qiQR8luEAIEpTCIfzLpF",
        buyerIdentity: user.id,
      });
      return NextResponse.json({ portalUrl }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    } catch (error) {
      console.error("Existing-subscription portal creation failed", error instanceof Error ? error.message : "Unknown error");
      return NextResponse.json({ error: "The membership portal is temporarily unavailable." }, { status: 503 });
    }
  }

  const { data: paidOrders, error: eligibilityError } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "membership")
    .eq("status", "paid")
    .limit(1);
  if (eligibilityError) {
    console.error("Unable to verify introductory offer eligibility", eligibilityError.message);
    return NextResponse.json({ error: "Pricing is temporarily unavailable." }, { status: 503 });
  }
  const weeklyIntro = planId === "weekly" && paidOrders.length === 0;
  const orderNo = generateOrderNo();
  const { error: insertError } = await supabase.from("orders").insert({
    user_id: user.id,
    order_no: orderNo,
    type: "membership",
    amount: weeklyIntro ? WEEKLY_INTRO_PRICE : plan.price,
    membership_months: planId === "monthly" ? 1 : planId === "yearly" ? 12 : null,
    membership_weeks: planId === "weekly" ? 1 : null,
    status: "pending",
    provider: "waffo",
    plan_id: planId,
    currency: "USD",
    auto_renew: true,
    subscription_status: "pending",
  });
  if (insertError) {
    console.error("Unable to create Waffo order", insertError.message);
    return NextResponse.json({ error: "Could not create the order." }, { status: 500 });
  }

  try {
    const result = await getWaffoClient().checkout.authenticated.create({
      productId: waffoProductId(planId),
      currency: "USD",
      buyerIdentity: user.id,
      buyerEmail: user.email || undefined,
      priceSnapshot: waffoPriceSnapshot(planId, weeklyIntro),
      ...(planId === "weekly" ? { withTrial: weeklyIntro } : {}),
      successUrl: siteUrl("/chat?payment=success"),
      expiresInSeconds: 3600,
      darkMode: false,
      language: locale,
      orderMerchantExternalId: orderNo,
      metadata: { orderNo, userId: user.id, planId },
    }, { idempotencyKey: `checkout-${orderNo}` });

    const { error: sessionError } = await supabase.from("orders")
      .update({ provider_session_id: result.sessionId })
      .eq("order_no", orderNo)
      .eq("user_id", user.id);
    if (sessionError) console.error("Unable to save Waffo checkout session", sessionError.message);

    return NextResponse.json({ orderNo, checkoutUrl: result.checkoutUrl }, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    await supabase.from("orders").update({ status: "failed", subscription_status: "checkout_failed" })
      .eq("order_no", orderNo).eq("user_id", user.id);
    console.error("Waffo checkout creation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
