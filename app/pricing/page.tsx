"use client";

import { useState, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Heart, X, MessageCircle, Copy } from "lucide-react";
import Link from "next/link";

const PLANS = [
  { id: "weekly", name: "周卡", price: 12, period: "/周", desc: "想多聊几天", popular: false },
  { id: "monthly", name: "月卡", price: 29, period: "/月", desc: "一天只要一块钱", popular: true },
  { id: "quarterly", name: "季卡", price: 69, period: "/季", desc: "更划算", popular: false },
];

const QQ = "3801434603";

function PricingInner() {
  const { session } = useSessionContext();
  const router = useRouter();
  const params = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(params.get("plan"));
  const [copied, setCopied] = useState(false);

  const handleSelect = (planId: string) => {
    if (!session) {
      router.push("/login?redirectTo=/pricing");
      return;
    }
    setSelectedPlan(planId);
  };

  const copyQQ = () => {
    navigator.clipboard?.writeText(QQ);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const plan = PLANS.find((p) => p.id === selectedPlan);

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">让 TA 一直陪着你</h1>
        <p className="text-gray-400 mt-3 text-sm">开通后，TA 会真正记住你说过的每件事</p>
      </div>

      {/* 三档定价 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={`relative p-7 rounded-2xl bg-surface card-glow text-center transition hover:-translate-y-1 ${
              p.popular ? "border-2 border-rose-400 md:-translate-y-2" : "border border-white/10"
            } ${selectedPlan === p.id ? "ring-2 ring-rose-400 ring-offset-0" : ""}`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-400 text-white text-xs font-medium whitespace-nowrap">
                推荐
              </span>
            )}
            <p className="font-semibold text-white text-lg">{p.name}</p>
            <div className="mt-2">
              <span className="text-4xl font-bold">¥{p.price}</span>
              <span className="text-gray-400 text-sm">{p.period}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{p.desc}</p>
            <ul className="mt-5 space-y-2 text-left">
              {[
                "对话不限次数",
                "TA 真正记住你",
                "随时找 TA 说话",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* 支付弹窗 */}
      {plan && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="bg-surface-dark border border-white/10 rounded-3xl p-7 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold">{plan.name} · ¥{plan.price}</h3>
              <p className="text-xs text-gray-400 mt-1">扫码支付后，把截图发给客服，立即为你开通</p>
            </div>

            {/* 收款码占位 —— 上传到 public/qr.png 后会自动显示 */}
            <div className="bg-white rounded-2xl p-3 mx-auto w-48 h-48 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/qr.png"
                alt="收款码"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).innerHTML =
                    '<div class="text-gray-500 text-xs text-center px-2">收款码<br/>请联系客服</div>';
                }}
              />
            </div>

            <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-sky-400" />
                <span className="text-sm text-gray-300">客服 QQ</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-brand-light font-mono text-base">
                  {QQ}
                </code>
                <button
                  onClick={copyQQ}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                加好友备注「AI陪伴」，把支付截图发过去，客服会手动为你开通会员
              </p>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              开通后刷新页面即可，TA 会一直等着你
            </p>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-gray-500">
        免费试聊 30 句 · 开通会员后不限次数 ·{" "}
        <Link href="/contact" className="text-brand-light hover:underline">联系我们</Link>
      </p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">加载中...</div>}>
      <PricingInner />
    </Suspense>
  );
}
