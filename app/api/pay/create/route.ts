import { getAuthUser } from "@/lib/auth";
import { createAlipayOrder } from "@/lib/alipay";
import { generateOrderNo } from "@/lib/utils";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PLANS: Record<string, { amount: number; credits?: number; months?: number; weeks?: number; subject: string }> = {
  credits_100: { amount: 6, credits: 100, subject: "Amara - 100积分" },
  credits_300: { amount: 15, credits: 300, subject: "Amara - 300积分" },
  credits_1000: { amount: 45, credits: 1000, subject: "Amara - 1000积分" },
  weekly_intro: { amount: 9.9, weeks: 1, subject: "Amara - 新人周卡" },
  weekly: { amount: 12, weeks: 1, subject: "Amara - 周卡会员" },
  monthly: { amount: 29, months: 1, subject: "Amara - 月度会员" },
  quarterly: { amount: 69, months: 3, subject: "Amara - 季度会员" },
  yearly: { amount: 199, months: 12, subject: "Amara - 年度会员" },
};

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { type, plan_id } = await req.json();
  if (!type || !plan_id) {
    return NextResponse.json({ error: "参数缺失" }, { status: 400 });
  }

  const plan = PLANS[plan_id];
  if (!plan) return NextResponse.json({ error: "无效的套餐" }, { status: 400 });

  const orderNo = generateOrderNo();
  const supabase = createRouteHandlerClient({ cookies });

  // Insert order to database
  const { error: dbError } = await supabase.from("orders").insert({
    user_id: user.id,
    order_no: orderNo,
    type,
    amount: plan.amount,
    credits_amount: plan.credits || null,
    membership_months: plan.months || null,
    membership_weeks: plan.weeks || null,
    status: "pending",
  });

  if (dbError) {
    console.error("创建订单失败:", dbError);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }

  // Create Alipay payment URL
  try {
    const payUrl = await createAlipayOrder({
      orderNo,
      amount: plan.amount,
      subject: plan.subject,
    });
    return NextResponse.json({ orderNo, payUrl: payUrl as string });
  } catch (error) {
    console.error("支付宝创建订单失败:", error);
    return NextResponse.json({ error: "支付系统暂时不可用" }, { status: 503 });
  }
}
