"use client";

import { useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, Sparkles, Heart } from "lucide-react";

const membershipPlans = [
  {
    id: "weekly_intro",
    name: "新人周卡",
    price: 9.9,
    period: "/周",
    tag: "新人专享",
    features: ["7 天 AI 情感陪伴不限量", "7 天 AI 对话不限量", "其他工具仍按积分计费", "每个用户限购一次"],
    popular: false,
    color: "rose",
  },
  {
    id: "monthly",
    name: "月度会员",
    price: 29,
    period: "/月",
    features: ["每月赠送 500 积分", "AI 对话 & 情感陪伴 不限量", "优先响应速度", "其他工具仍按积分计费"],
    popular: true,
    color: "brand",
  },
  {
    id: "yearly",
    name: "年度会员",
    price: 199,
    period: "/年",
    features: ["每月赠送 800 积分", "AI 对话 & 情感陪伴 不限量", "最高优先级", "相当于 ¥16.6/月"],
    popular: false,
    color: "yellow",
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
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">选择适合你的方案</h1>
        <p className="text-gray-400 mt-3">注册即送 50 积分免费体验，觉得好用再充值</p>
      </div>

      {/* Membership */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {membershipPlans.map((plan) => {
          const isHot = plan.id === "weekly_intro";
          const colorCls =
            plan.color === "rose" ? "border-rose-400" :
            plan.color === "yellow" ? "border-yellow-400/60" :
            "border-brand";
          return (
            <div
              key={plan.id}
              className={`relative p-7 rounded-2xl bg-surface card-glow border-2 ${colorCls} ${
                plan.popular ? "md:-translate-y-2" : ""
              }`}
            >
              {plan.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-400 text-white text-xs font-medium whitespace-nowrap">
                  {plan.tag}
                </span>
              )}
              {plan.popular && !plan.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-xs font-medium">
                  推荐
                </span>
              )}
              {isHot ? (
                <Heart className="w-8 h-8 text-rose-400 mb-4" />
              ) : plan.color === "yellow" ? (
                <Crown className="w-8 h-8 text-yellow-400 mb-4" />
              ) : (
                <Sparkles className="w-8 h-8 text-brand mb-4" />
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-3">
                <span className="text-3xl font-bold">¥{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handlePurchase("membership", plan.id)}
                disabled={loading === plan.id}
                className={`w-full mt-8 py-3 rounded-xl text-white font-semibold disabled:opacity-50 ${
                  isHot ? "bg-rose-500 hover:bg-rose-600" : "gradient-btn"
                }`}
              >
                {loading === plan.id ? "跳转中..." : isHot ? "立即体验" : "立即开通"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Credits */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold">积分充值</h2>
        <p className="text-gray-400 text-sm mt-2">用于 AI 文案、脚本、简历等生成类工具（会员也可用于超出赠送额度）</p>
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
      <div className="mt-16 text-center text-sm text-gray-500 space-y-1">
        <p>会员特权：AI 对话、AI 情感陪伴 对话不限量（不扣积分）</p>
        <p>其他生成类工具（小红书、抖音、简历等）会员仍按积分计费，每月赠送积分可优先使用</p>
        <p>积分消耗标准：AI对话/情感陪伴 2积分/条 · 自媒体工具 3-5积分/次 · 简历优化 8积分/次</p>
      </div>
    </div>
  );
}
