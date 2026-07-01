// @ts-nocheck
import AlipaySdk from "alipay-sdk";
import AlipayFormData from "alipay-sdk/lib/form";

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
});

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

  const result = await alipaySdk.exec("alipay.trade.page.pay", {}, { formData });
  return result as string; // Returns payment URL
}

export function verifyAlipayNotify(params: Record<string, string>) {
  return alipaySdk.checkNotifySign(params);
}
