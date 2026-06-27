import { NextResponse } from "next/server";

// 统一定价数据 —— 付费墙和"我的"页都读这里
const PLANS = [
  {
    id: "weekly",
    name: "周卡",
    price: 12,
    period: "/周",
    membershipWeeks: 1,
    popular: false,
    hint: "想多聊几天",
  },
  {
    id: "monthly",
    name: "月卡",
    price: 29,
    period: "/月",
    membershipMonths: 1,
    popular: true,
    hint: "一天只要一块钱",
  },
  {
    id: "quarterly",
    name: "季卡",
    price: 69,
    period: "/季",
    membershipMonths: 3,
    popular: false,
    hint: "更划算",
  },
];

export async function GET() {
  return NextResponse.json({ plans: PLANS });
}
