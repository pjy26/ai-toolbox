// @ts-nocheck
import { createServerAdminClient } from "@/lib/supabase";

/**
 * 订单履约：标记已支付 + 发放权益（会员/积分）
 * 幂等——只有 pending 订单会被处理，重复调用安全返回 "already"
 * 供 /api/pay/notify（支付宝异步通知）和 /api/pay/return（回跳主动查单）共用
 */
export async function fulfillOrder(orderNo: string): Promise<"paid" | "already" | "notfound"> {
  const supabase = createServerAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("order_no", orderNo)
    .single();

  if (!order) return "notfound";
  if (order.status !== "pending") return "already";

  await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, membership_type, membership_expires_at")
    .eq("id", order.user_id)
    .single();

  if (!profile) return "paid";

  if (order.type === "credits" && order.credits_amount) {
    await supabase
      .from("profiles")
      .update({ credits: profile.credits + order.credits_amount })
      .eq("id", order.user_id);
  } else if (order.type === "membership" && (order.membership_months || order.membership_weeks)) {
    const base =
      profile.membership_expires_at && new Date(profile.membership_expires_at) > new Date()
        ? new Date(profile.membership_expires_at)
        : new Date();

    if (order.membership_weeks) {
      base.setDate(base.getDate() + 7 * order.membership_weeks);
      await supabase
        .from("profiles")
        .update({
          membership_type: "weekly",
          membership_expires_at: base.toISOString(),
        })
        .eq("id", order.user_id);
    } else if (order.membership_months) {
      base.setMonth(base.getMonth() + order.membership_months);
      const membershipType = order.membership_months >= 12 ? "yearly" : "monthly";
      const bonusCredits = membershipType === "yearly" ? 800 : 500;
      await supabase
        .from("profiles")
        .update({
          membership_type: membershipType,
          membership_expires_at: base.toISOString(),
          credits: profile.credits + bonusCredits,
        })
        .eq("id", order.user_id);
    }
  }

  return "paid";
}
