// @ts-nocheck
import AlipaySdk from "alipay-sdk";
import AlipayFormData from "alipay-sdk/lib/form";

// Vercel 等平台的 env 粘贴多行 PEM 密钥时，换行常被存成字面量 "\n"，
// Node crypto 解析会报 DECODER routines::unsupported——统一归一化为真实换行
const normalizeKey = (k?: string) => (k || "").replace(/\\n/g, "\n");

// 懒加载：Next.js 构建期（collect page data）会 import 路由模块，
// 此时环境变量未必就绪，模块顶层直接 new 会导致构建失败
let _sdk: InstanceType<typeof AlipaySdk> | null = null;
function getSdk(): InstanceType<typeof AlipaySdk> {
  if (!_sdk) {
    _sdk = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID!,
      privateKey: normalizeKey(process.env.ALIPAY_PRIVATE_KEY),
      alipayPublicKey: normalizeKey(process.env.ALIPAY_PUBLIC_KEY),
      gateway: process.env.ALIPAY_GATEWAY || "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    });
  }
  return _sdk;
}

export async function createAlipayOrder(params: {
  orderNo: string;
  amount: number;
  subject: string;
}) {
  const formData = new AlipayFormData();
  formData.setMethod("get");
  formData.addField("notifyUrl", process.env.ALIPAY_NOTIFY_URL!);
  formData.addField("returnUrl", process.env.ALIPAY_RETURN_URL!);
  formData.addField("bizContent", {
    out_trade_no: params.orderNo,
    total_amount: params.amount.toFixed(2),
    subject: params.subject,
    product_code: "FAST_INSTANT_TRADE_PAY",
  });

  const result = await getSdk().exec("alipay.trade.page.pay", {}, { formData });
  return result as string; // Returns payment URL
}

export function verifyAlipayNotify(params: Record<string, string>) {
  return getSdk().checkNotifySign(params);
}

/**
 * 主动向支付宝查询交易状态（服务器到服务器）
 * 用于回跳时兜底履约，不依赖可能延迟/丢失的异步通知
 * 返回 trade_status（TRADE_SUCCESS / WAIT_BUYER_PAY 等），查询失败返回 null
 */
export async function queryAlipayTradeStatus(orderNo: string): Promise<string | null> {
  try {
    const result = (await getSdk().exec("alipay.trade.query", {
      bizContent: { out_trade_no: orderNo },
    })) as { tradeStatus?: string; trade_status?: string; code?: string };
    return result.tradeStatus || result.trade_status || null;
  } catch (error) {
    console.error("支付宝主动查单失败:", error);
    return null;
  }
}
