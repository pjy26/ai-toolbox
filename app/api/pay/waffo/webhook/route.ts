import { verifyWebhook, type WebhookEvent } from "@waffo/pancake-ts";
import { createServerAdminClient } from "@/lib/supabase";
import { generateOrderNo } from "@/lib/utils";
import { MEMBERSHIP_PLANS, isMembershipPlanId, type MembershipPlanId } from "@/lib/membership-plans";
import { waffoEnvironment, waffoStoreId } from "@/lib/waffo";

export const runtime = "nodejs";

const PERIOD_EVENTS = new Set([
  "subscription.activated",
  "subscription.renewed",
  "subscription.recovered",
  "subscription.plan_changed",
]);

type OrderRow = {
  id: string;
  user_id: string;
  order_no: string;
  plan_id: MembershipPlanId | null;
  last_webhook_at: string | null;
};

function planFromEvent(event: WebhookEvent, order?: OrderRow | null): MembershipPlanId | null {
  const candidate = event.data.orderMetadata?.planId || event.data.billingPeriod || order?.plan_id;
  return isMembershipPlanId(candidate) ? candidate : null;
}

async function findOrder(supabase: ReturnType<typeof createServerAdminClient>, event: WebhookEvent): Promise<OrderRow | null> {
  const externalId = event.data.orderMerchantExternalId;
  if (externalId) {
    const { data, error } = await supabase.from("orders")
      .select("id, user_id, order_no, plan_id, last_webhook_at")
      .eq("provider", "waffo").eq("order_no", externalId).maybeSingle();
    if (error) throw new Error(`Order lookup failed: ${error.message}`);
    if (data) return data as OrderRow;
  }
  const { data, error } = await supabase.from("orders")
    .select("id, user_id, order_no, plan_id, last_webhook_at")
    .eq("provider", "waffo").eq("provider_order_id", event.data.orderId).maybeSingle();
  if (error) throw new Error(`Provider order lookup failed: ${error.message}`);
  return (data as OrderRow | null) || null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let event: WebhookEvent;
  try {
    event = verifyWebhook(rawBody, req.headers.get("x-waffo-signature"), { environment: waffoEnvironment() });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (event.storeId !== waffoStoreId() || event.mode !== waffoEnvironment()) {
    return new Response("Wrong store or environment", { status: 400 });
  }

  const supabase = createServerAdminClient();
  const { data: existingEvent, error: eventLookupError } = await supabase
    .from("waffo_webhook_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (eventLookupError) return new Response("Event storage unavailable", { status: 503 });
  if (existingEvent?.processed_at) return new Response("OK");

  if (!existingEvent) {
    const { error } = await supabase.from("waffo_webhook_events").insert({
      id: event.id,
      event_type: event.eventType,
      mode: event.mode,
    });
    if (error) {
      // Another delivery may have inserted it between our read and insert.
      const { data: concurrent } = await supabase.from("waffo_webhook_events")
        .select("processed_at").eq("id", event.id).maybeSingle();
      if (concurrent?.processed_at) return new Response("OK");
      if (!concurrent) return new Response("Could not record event", { status: 503 });
    }
  }

  try {
    let order = await findOrder(supabase, event);
    const identity = event.data.merchantProvidedBuyerIdentity || event.data.orderMetadata?.userId;
    if (order && identity && order.user_id !== identity) throw new Error("Webhook identity does not match order owner");
    const userId = order?.user_id || identity;
    if (!userId) throw new Error("No merchant buyer identity on webhook");

    if (!order) {
      const planId = planFromEvent(event);
      if (!planId) throw new Error("Cannot determine membership plan");
      const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId)!;
      const orderNo = event.data.orderMerchantExternalId || generateOrderNo();
      const { data, error } = await supabase.from("orders").insert({
        user_id: userId,
        order_no: orderNo,
        type: "membership",
        amount: plan.price,
        status: "pending",
        provider: "waffo",
        provider_order_id: event.data.orderId,
        plan_id: planId,
        currency: event.data.currency,
        auto_renew: planId !== "plus_trial",
        subscription_status: "pending",
      }).select("id, user_id, order_no, plan_id, last_webhook_at").single();
      if (error) throw new Error(`Could not create webhook order: ${error.message}`);
      order = data as OrderRow;
    }

    const isSubscriptionStateEvent = event.eventType.startsWith("subscription.") && event.eventType !== "subscription.payment_succeeded";
    // Payment receipts and subscription state arrive independently. Only state events
    // participate in ordering, so a newer receipt cannot suppress an activation event.
    if (isSubscriptionStateEvent && order.last_webhook_at && Date.parse(order.last_webhook_at) >= Date.parse(event.timestamp)) {
      await supabase.from("waffo_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", event.id);
      return new Response("OK");
    }

    const data = event.data;
    const planId = planFromEvent(event, order);
    const suppliedPeriodEnd = data.currentPeriodEnd && Number.isFinite(Date.parse(data.currentPeriodEnd)) ? data.currentPeriodEnd : null;
    const eventTime = Date.parse(event.timestamp);
    const trialPeriodEnd = planId === "plus_trial" && Number.isFinite(eventTime)
      ? new Date(eventTime + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const periodEnd = suppliedPeriodEnd || trialPeriodEnd;
    const isTrialPayment = event.eventType === "subscription.payment_succeeded" && planId === "plus_trial";
    const baseUpdate: Record<string, unknown> = {
      provider_order_id: data.orderId,
      currency: data.currency,
      ...(isSubscriptionStateEvent ? { last_webhook_at: event.timestamp } : {}),
    };
    if (planId) baseUpdate.plan_id = planId;

    if (PERIOD_EVENTS.has(event.eventType)) {
      if (!planId || !periodEnd) {
        throw new Error("Subscription event lacks a valid plan or currentPeriodEnd");
      }
      Object.assign(baseUpdate, {
        status: "paid",
        paid_at: new Date().toISOString(),
        subscription_status: data.orderStatus || "active",
        current_period_end: periodEnd,
        auto_renew: planId !== "plus_trial",
        canceled_at: null,
      });
    } else if (event.eventType === "subscription.payment_succeeded") {
      if (isTrialPayment && !periodEnd) throw new Error("Trial payment lacks a valid timestamp or currentPeriodEnd");
      Object.assign(baseUpdate, {
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_payment_id: data.paymentId || null,
        ...(data.chargedAmount ? { amount: Number(data.chargedAmount) } : {}),
        ...(isTrialPayment ? {
          subscription_status: "active",
          current_period_end: periodEnd,
          auto_renew: false,
          canceled_at: null,
        } : {}),
      });
    } else if (event.eventType === "subscription.canceling") {
      Object.assign(baseUpdate, {
        subscription_status: "canceling",
        auto_renew: false,
        current_period_end: data.currentPeriodEnd || null,
        canceled_at: data.canceledAt || event.timestamp,
      });
    } else if (event.eventType === "subscription.uncanceled") {
      Object.assign(baseUpdate, {
        subscription_status: data.orderStatus || "active",
        auto_renew: planId !== "plus_trial",
        current_period_end: data.currentPeriodEnd || null,
        canceled_at: null,
      });
    } else if (event.eventType === "subscription.past_due") {
      Object.assign(baseUpdate, {
        subscription_status: "past_due",
        current_period_end: data.currentPeriodEnd || null,
      });
    } else if (event.eventType === "subscription.canceled") {
      Object.assign(baseUpdate, {
        subscription_status: "canceled",
        auto_renew: false,
        canceled_at: data.canceledAt || event.timestamp,
      });
    } else if (event.eventType === "subscription.plan_change_scheduled" || event.eventType === "subscription.plan_change_failed") {
      // The existing subscription remains active until a plan change takes effect.
      baseUpdate.subscription_status = data.orderStatus || "active";
    } else if (event.eventType === "refund.succeeded" || event.eventType === "refund.failed") {
      // Refund events do not change subscription state; only a verified full refund below does.
      baseUpdate.provider_payment_id = data.paymentId || null;
    }

    const { error: orderError } = await supabase.from("orders").update(baseUpdate).eq("id", order.id);
    if (orderError) throw new Error(`Order update failed: ${orderError.message}`);

    // Only the user's currently recorded subscription can alter profile entitlements.
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("membership_provider_order_id").eq("id", userId).maybeSingle();
    if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
    const isCurrent = !profile?.membership_provider_order_id || profile.membership_provider_order_id === data.orderId;
    let profileUpdate: Record<string, unknown> | null = null;

    if ((PERIOD_EVENTS.has(event.eventType) || isTrialPayment) && isCurrent) {
      if (!periodEnd) throw new Error("Cannot activate membership without a valid period end");
      profileUpdate = {
        membership_type: planId,
        membership_expires_at: periodEnd,
        membership_provider_order_id: data.orderId,
        membership_auto_renew: planId !== "plus_trial",
      };
    } else if ((event.eventType === "subscription.canceling" || event.eventType === "subscription.past_due") && profile?.membership_provider_order_id === data.orderId) {
      profileUpdate = { membership_auto_renew: event.eventType !== "subscription.canceling" };
    } else if (event.eventType === "subscription.uncanceled" && profile?.membership_provider_order_id === data.orderId) {
      profileUpdate = { membership_auto_renew: true };
    } else if (event.eventType === "subscription.canceled" && profile?.membership_provider_order_id === data.orderId) {
      profileUpdate = {
        membership_type: "free",
        membership_expires_at: null,
        membership_provider_order_id: null,
        membership_auto_renew: false,
      };
    } else if (event.eventType === "refund.succeeded") {
      const refunded = Number(data.refundedAmount);
      const charged = Number(data.originalChargedAmount);
      const fullRefund = Number.isFinite(refunded) && Number.isFinite(charged) && charged > 0 && refunded >= charged;
      if (fullRefund) {
        const { error: refundOrderError } = await supabase.from("orders")
          .update({ subscription_status: "refunded", auto_renew: false }).eq("id", order.id);
        if (refundOrderError) throw new Error(`Refund order update failed: ${refundOrderError.message}`);
        if (profile?.membership_provider_order_id === data.orderId) {
          profileUpdate = {
            membership_type: "free",
            membership_expires_at: null,
            membership_provider_order_id: null,
            membership_auto_renew: false,
          };
        }
      }
    }

    if (profileUpdate) {
      const { error } = await supabase.from("profiles").update(profileUpdate).eq("id", userId);
      if (error) throw new Error(`Membership update failed: ${error.message}`);
    }

    const { error: completeError } = await supabase.from("waffo_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", event.id);
    if (completeError) throw new Error(`Event completion failed: ${completeError.message}`);
    return new Response("OK");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error("Waffo webhook processing failed", { eventId: event.id, eventType: event.eventType, message });
    await supabase.from("waffo_webhook_events").update({ processing_error: message.slice(0, 1000), processed_at: null }).eq("id", event.id);
    return new Response("Processing failed", { status: 500 });
  }
}
