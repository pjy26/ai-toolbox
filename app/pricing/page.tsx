"use client";

import { useState, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Heart, X, MessageCircle, Copy } from "lucide-react";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const PLANS = [
  { id: "weekly", price: 12, popular: false },
  { id: "monthly", price: 29, popular: true },
  { id: "quarterly", price: 69, popular: false },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

const QQ = "3801434603";

function PricingInner() {
  const { session } = useSessionContext();
  const router = useRouter();
  const params = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(params.get("plan"));
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);
  const { t } = useLocale();

  const handleSelect = (planId: PlanId) => {
    if (!session) {
      const destination = `/pricing?plan=${planId}`;
      router.push(`/login?redirectTo=${encodeURIComponent(destination)}`);
      return;
    }
    setQrError(false);
    setSelectedPlan(planId);
  };

  const copyQQ = async () => {
    try {
      await navigator.clipboard.writeText(QQ);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const plan = PLANS.find((item) => item.id === selectedPlan);
  const planNames: Record<PlanId, string> = {
    weekly: t.pricing.weekly,
    monthly: t.pricing.monthly,
    quarterly: t.pricing.quarterly,
  };
  const planPeriods: Record<PlanId, string> = {
    weekly: t.pricing.perWeek,
    monthly: t.pricing.perMonth,
    quarterly: t.pricing.perQuarter,
  };
  const planDescriptions: Record<PlanId, string> = {
    weekly: t.pricing.weeklyDescription,
    monthly: t.pricing.monthlyDescription,
    quarterly: t.pricing.quarterlyDescription,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="flex justify-end mb-4"><LocaleToggle /></div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">{t.pricing.title}</h1>
        <p className="text-gray-400 mt-3 text-sm max-w-2xl mx-auto leading-relaxed">{t.pricing.subtitle}</p>
      </div>

      <div className="max-w-3xl mx-auto mb-10 rounded-2xl border border-amber-300/15 bg-amber-300/5 px-5 py-4 text-center">
        <p className="text-xs leading-relaxed text-gray-300">{t.pricing.currentAvailability}</p>
        <p className="mt-2 text-xs text-gray-500">{t.pricing.fixedAccess}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {PLANS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            className={`relative p-7 rounded-2xl bg-surface card-glow text-center transition hover:-translate-y-1 ${
              item.popular ? "border-2 border-rose-400 md:-translate-y-2" : "border border-white/10"
            } ${selectedPlan === item.id ? "ring-2 ring-rose-400 ring-offset-0" : ""}`}
          >
            {item.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-400 text-white text-xs font-medium whitespace-nowrap">
                {t.pricing.recommended}
              </span>
            )}
            <p className="font-semibold text-white text-lg">{planNames[item.id]}</p>
            <div className="mt-2">
              <span className="text-4xl font-bold">¥{item.price}</span>
              <span className="text-gray-400 text-sm"> {planPeriods[item.id]}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{planDescriptions[item.id]}</p>
            <ul className="mt-5 space-y-2 text-left">
              {[t.pricing.unlimited, t.pricing.memories, t.pricing.anytime].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {plan && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedPlan(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${planNames[plan.id]} · ¥${plan.price}`}
        >
          <div
            className="bg-surface-dark border border-white/10 rounded-3xl p-7 max-w-md w-full relative max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold">{planNames[plan.id]} · ¥{plan.price}</h2>
              <p className="text-sm font-medium text-gray-200 mt-2">{t.pricing.paymentTitle}</p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{t.pricing.paymentInstructions}</p>
            </div>

            <div className="bg-white rounded-2xl p-3 mx-auto w-48 h-48 flex items-center justify-center">
              {qrError ? (
                <p className="text-gray-500 text-xs text-center px-2">{t.pricing.qrUnavailable}</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/qr.png"
                  alt={t.pricing.qrAlt}
                  className="w-full h-full object-contain"
                  onError={() => setQrError(true)}
                />
              )}
            </div>

            <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-sky-400" />
                <span className="text-sm text-gray-300">{t.pricing.supportQq}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-brand-light font-mono text-base">
                  {QQ}
                </code>
                <button
                  type="button"
                  onClick={copyQQ}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? t.pricing.copied : t.pricing.copy}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{t.pricing.supportNote}</p>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">{t.pricing.activationNote}</p>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-gray-500">
        {t.pricing.freeTrial} · {t.pricing.unlimitedMember} ·{" "}
        <Link href="/contact" className="text-brand-light hover:underline">{t.pricing.contact}</Link>
      </p>
      <p className="mt-4 max-w-2xl mx-auto text-center text-xs leading-relaxed text-gray-500">{t.pricing.refundNote}</p>
      <p className="mt-6 text-center text-xs text-gray-500">
        <Link href="/terms" className="hover:text-brand-light">{t.login.terms}</Link>
        <span className="mx-2">·</span>
        <Link href="/content-policy" className="hover:text-brand-light">{t.login.contentPolicy}</Link>
      </p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">Loading pricing...</div>}>
      <PricingInner />
    </Suspense>
  );
}
