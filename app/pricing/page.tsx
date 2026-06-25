"use client";

import { useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap } from "lucide-react";

const membershipPlans = [
  {
    id: "monthly",
    name: "月度会员",
    price: 29,
    period: "/月",
    features: ["每月赠送 500 积分", "优先响应速度", "全部工具无限制"],
    popular: true,
  },
  {
    id: "yearly",
    name: "年度会员",
    price: 199,
    period: "/年",
    features: ["每月赠送 800 积分", "最高优先级", "全部工具无限制", "相当于 ¥16.6/月"],
    popular: false,
  },
];

const creditPlans = [
  { id: "credits_100", credits: 100, price: 6 },
  { id: "credits_300", credits: 300, price: 15 },
  { id: "credits_1000", credits: 1000, price: 45 },
];

export default function PricingPage() {
  const { session } = useSessionContext();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (type: string, planId: string) => {
    if (!session) {
      router.push("/login?redirectTo=/pricing");
      return;
    }

    setLoading(planId);
    try {
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, plan_id: planId }),
      });
      const data = await res.json();
      if (data.payUrl) {
        window.location.href = data.payUrl;
      } else {
        alert(data.error || "创建订单失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">选择适合你的方案</h1>
        <p className="text-gray-400 mt-3">注册即送 50 积分免费体验，觉得好用再充值</p>
      </div>

      {/* Membership */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 max-w-3xl mx-auto">
        {membershipPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative p-8 rounded-2xl bg-surface card-glow ${
              plan.popular ? "border-2 border-brand" : "border border-white/10"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-xs font-medium">
                推荐
              </span>
            )}
            <Crown className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold">¥{plan.price}</span>
              <span className="text-gray-400">{plan.period}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePurchase("membership", plan.id)}
              disabled={loading === plan.id}
              className="w-full mt-8 py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
            >
              {loading === plan.id ? "跳转中..." : "立即开通"}
            </button>
          </div>
        ))}
      </div>

      {/* Credits */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold">积分充值</h2>
        <p className="text-gray-400 text-sm mt-2">按需购买，灵活使用</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {creditPlans.map((plan) => (
          <div key={plan.id} className="p-6 rounded-2xl bg-surface card-glow text-center">
            <Zap className="w-6 h-6 text-brand mx-auto mb-2" />
            <p className="text-2xl font-bold">{plan.credits}</p>
            <p className="text-sm text-gray-400 mb-4">积分</p>
            <p className="text-lg font-semibold mb-4">¥{plan.price}</p>
            <button
              onClick={() => handlePurchase("credits", plan.id)}
              disabled={loading === plan.id}
              className="w-full py-2.5 rounded-lg border border-brand text-brand-light hover:bg-brand/10 transition font-medium text-sm disabled:opacity-50"
            >
              {loading === plan.id ? "跳转中..." : "购买"}
            </button>
          </div>
        ))}
      </div>

      {/* Pricing table */}
      <div className="mt-16 text-center text-sm text-gray-500">
        <p>积分消耗标准：AI对话 2积分/条 | 自媒体工具 3-5积分/次 | 简历优化 8积分/次</p>
      </div>
    </div>
  );
}
