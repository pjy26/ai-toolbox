import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { queryAlipayTradeStatus } from "@/lib/alipay";
import { fulfillOrder } from "@/lib/fulfill";

/**
 * 支付宝同步回跳：用户付完款被带到这里
 * 主动向支付宝查单并立即履约（幂等），不再单纯等待异步通知——
 * 异步通知（/api/pay/notify）仍是主通道，这里是体验兜底
 */
export async function GET(req: NextRequest) {
  const orderNo = req.nextUrl.searchParams.get("out_trade_no");
  let target = "/chat";

  if (orderNo) {
    target = "/chat?payment=processing";
    try {
      const tradeStatus = await queryAlipayTradeStatus(orderNo);
      if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
        await fulfillOrder(orderNo);
        target = "/chat?payment=success";
      }
    } catch (error) {
      // 查单失败不阻塞用户，异步通知到达后仍会开通
      console.error("回跳主动查单履约失败:", error);
    }
  }

  redirect(target);
}
