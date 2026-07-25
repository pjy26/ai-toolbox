import { verifyAlipayNotify } from "@/lib/alipay";
import { fulfillOrder } from "@/lib/fulfill";

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

    if (!orderNo || (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED")) {
      return new Response("success"); // Acknowledge but don't process
    }

    // Step 2: Fulfill (idempotent — 与回跳主动查单共用)
    await fulfillOrder(orderNo);

    return new Response("success");
  } catch (error) {
    console.error("支付回调处理错误:", error);
    return new Response("fail", { status: 500 });
  }
}
