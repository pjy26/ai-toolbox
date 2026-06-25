import { verifyAlipayNotify } from "@/lib/alipay";
import { createServerAdminClient } from "@/lib/supabase";

/**
 * Alipay async notification callback (server-to-server)
 * No auth required — verified via Alipay signature
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));

    // Step 1: Verify Alipay signature
    const valid = verifyAlipayNotify(params);
    if (!valid) {
      console.error("支付宝签名验证失败", params);
      return new Response("fail", { status: 400 });
    }

    const orderNo = params["out_trade_no"];
    const tradeStatus = params["trade_status"];

    if (!orderNo || tradeStatus !== "TRADE_SUCCESS") {
      return new Response("success"); // Acknowledge but don't process
    }

    // Step 2: Use admin client (service role) since this is a public callback
    const supabase = createServerAdminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_no", orderNo)
      .single();

    if (!order || order.status !== "pending") {
      return new Response("success"); // Already processed or not found
    }

    // Step 3: Update order status
    await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id);

    // Step 4: Fulfill the order
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits, membership_type, membership_expires_at")
      .eq("id", order.user_id)
      .single();

    if (!profile) return new Response("success");

    if (order.type === "credits" && order.credits_amount) {
      await supabase
        .from("profiles")
        .update({ credits: profile.credits + order.credits_amount })
        .eq("id", order.user_id);
    } else if (order.type === "membership" && order.membership_months) {
      // Extend from current expiry if still active
      const base =
        profile.membership_expires_at && new Date(profile.membership_expires_at) > new Date()
          ? new Date(profile.membership_expires_at)
          : new Date();
      base.setMonth(base.getMonth() + order.membership_months);

      const membershipType = order.membership_months >= 12 ? "yearly" : "monthly";
      // Grant monthly bonus credits
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

    return new Response("success");
  } catch (error) {
    console.error("支付回调处理错误:", error);
    return new Response("fail", { status: 500 });
  }
}
