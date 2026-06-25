import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * Alipay synchronous return — just redirect user to dashboard
 * Actual order fulfillment happens in /api/pay/notify (async)
 */
export async function GET(req: NextRequest) {
  // User is redirected here after payment on Alipay page
  // The actual fulfillment is handled by the async notify callback
  redirect("/dashboard?payment=success");
}
