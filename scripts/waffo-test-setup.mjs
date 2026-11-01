import { WaffoPancake } from "@waffo/pancake-ts";

const merchantId = process.env.WAFFO_MERCHANT_ID;
const storeId = process.env.WAFFO_STORE_ID;
const privateKey = process.env.WAFFO_PRIVATE_KEY;
if (!merchantId || !storeId || !privateKey) {
  throw new Error("Waffo test environment variables are required");
}

const client = new WaffoPancake({ merchantId, storeId, privateKey, environment: "test" });
const result = await client.graphql.query({
  query: "query { stores { id name status } }",
});
const stores = result.data?.stores || [];
const store = stores.find((item) => item.id === storeId);
if (!store) throw new Error("Configured test store was not returned by Waffo");
console.log(JSON.stringify({ connection: "ok", store: { id: store.id, name: store.name, status: store.status } }));

if (process.argv.includes("--setup")) {
  const plans = [
    { id: "weekly", name: "Amara Weekly", billingPeriod: "weekly", amount: "1.99", trialAmount: "0.99" },
    { id: "monthly", name: "Amara Monthly", billingPeriod: "monthly", amount: "3.99" },
    { id: "yearly", name: "Amara Yearly", billingPeriod: "yearly", amount: "29.90" },
  ];
  const products = {};
  for (const plan of plans) {
    const { product } = await client.subscriptionProducts.create({
      storeId,
      name: plan.name,
      description: "Amara AI companion membership",
      billingPeriod: plan.billingPeriod,
      prices: { USD: { amount: plan.amount, taxCategory: "saas", ...(plan.trialAmount ? { trialAmount: plan.trialAmount } : {}) } },
      successUrl: "https://amarapjy.xyz/chat?payment=success",
      metadata: { planId: plan.id, ...(plan.trialAmount ? { trialDays: 7 } : {}) },
    }, { idempotencyKey: `amara-test-${plan.id}-product-v1` });
    products[plan.id] = product.id;
    console.log(JSON.stringify({ product: plan.id, id: product.id, status: product.status }));
  }

  const { webhook } = await client.webhooks.add({
    storeId,
    channel: "http",
    url: "https://amarapjy.xyz/api/pay/waffo/webhook",
    testMode: true,
    events: [
      "subscription.activated",
      "subscription.payment_succeeded",
      "subscription.renewed",
      "subscription.recovered",
      "subscription.plan_changed",
      "subscription.plan_change_scheduled",
      "subscription.plan_change_failed",
      "subscription.canceling",
      "subscription.uncanceled",
      "subscription.canceled",
      "subscription.past_due",
      "refund.succeeded",
      "refund.failed",
    ],
  }, { idempotencyKey: "amara-test-subscription-webhook-v1" });
  console.log(JSON.stringify({ webhook: { id: webhook.id, url: webhook.url, testMode: webhook.testMode } }));
  console.log(JSON.stringify({ products }));
}
