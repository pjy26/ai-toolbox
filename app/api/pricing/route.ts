import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { MEMBERSHIP_CURRENCY, membershipPlans } from "@/lib/membership-plans";

// 统一美元定价。只有已支付会员订单才消耗新客资格，放弃结账不影响优惠。
export async function GET() {
  const user = await getAuthUser();
  let weeklyIntroEligible = true;

  if (user) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "membership")
      .eq("status", "paid")
      .limit(1);

    // 无法核实资格时不展示优惠价，避免对用户做出无法兑现的承诺。
    weeklyIntroEligible = !error && data.length === 0;
  }

  return NextResponse.json(
    {
      currency: MEMBERSHIP_CURRENCY,
      weeklyIntroEligible,
      plans: membershipPlans(weeklyIntroEligible),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
