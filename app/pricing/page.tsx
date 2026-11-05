"use client";

import { useEffect, useState, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X, Mail, Copy, ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { formatUsd, isCheckoutPlanId, membershipPlans, SUPPORT_EMAIL, type CheckoutPlanId, type MembershipPlan } from "@/lib/membership-plans";
import { openWaffoCheckout } from "@/lib/waffo-browser";
import { trackProductEvent } from "@/lib/product-events";

const pageCopy = {
  en: {
    eyebrow: "Amara membership",
    title: "Choose how your relationship grows.",
    subtitle: "Start with the essentials. Open deeper shared experiences with Plus, or return anytime on Free. Prices are in USD.",
    monthly: "Monthly",
    yearly: "Yearly",
    perMonth: "/ month",
    perYear: "/ year",
    free: "Free",
    freeBody: "A meaningful beginning, with the essentials always visible.",
    freePrice: "$0",
    freeCta: "Continue with Free",
    plus: "Plus",
    plusBody: "The complete relationship memory—shared moments, reflection, and growing understanding.",
    premium: "Premium",
    premiumBody: "A deeper layer of understanding and personalization, currently being developed.",
    recommended: "Most loved",
    choosePlus: "Choose Plus",
    upgrading: "Upgrade in development",
    unavailable: "Premium subscriptions are not available yet. You can use every currently available relationship feature with Plus.",
    trialTitle: "Try every Plus feature for one week.",
    trialBody: "$0.99 once · 7 days · no automatic renewal. One introductory experience per account while available.",
    trialCta: "Start one-week Plus",
    freeFeatures: ["Today and About You", "One important person", "Visible, deletable basic memories"],
    plusFeatures: ["Everything in Free", "Unlimited important people", "Our Moments, Dreams, and Letters", "Multidimensional memory analysis", "Unlimited conversations"],
    premiumFeatures: ["Everything in Plus", "Deeper cross-dimension understanding", "More personalized Amara growth", "Advanced relationship insights"],
    future: "Planned",
    renewal: "Plus monthly and yearly memberships renew automatically until canceled. The one-week experience does not renew.",
    bottom: "Not just remembered. Truly understood. Amara grows with you.",
  },
  zh: {
    eyebrow: "Amara 会员",
    title: "选择你们的关系，如何继续生长。",
    subtitle: "从基础连续性开始，用 Plus 打开完整的共同经历与理解，也可以随时回到 Free。价格以美元计。",
    monthly: "按月",
    yearly: "按年",
    perMonth: "/ 月",
    perYear: "/ 年",
    free: "Free",
    freeBody: "一段有意义的开始，基础记忆始终可见、由你管理。",
    freePrice: "$0",
    freeCta: "继续使用 Free",
    plus: "Plus",
    plusBody: "完整的关系记忆：共同瞬间、情感回应，以及随你们一起变化的理解。",
    premium: "Premium",
    premiumBody: "更深入的理解与个性化能力，目前正在升级开发中。",
    recommended: "最受欢迎",
    choosePlus: "选择 Plus",
    upgrading: "升级中，暂不支持订阅",
    unavailable: "Premium 暂不支持订阅。目前所有已开放的关系功能，都可以通过 Plus 使用。",
    trialTitle: "用一周，体验完整的 Plus。",
    trialBody: "一次支付 $0.99 · 7 天 · 到期不自动续费。活动开放期间，每个账号限体验一次。",
    trialCta: "开始一周 Plus 体验",
    freeFeatures: ["今天与关于你", "记录一位重要的人", "基础记忆可见、可删除"],
    plusFeatures: ["包含 Free 全部功能", "不限人数的重要的人", "我们的瞬间、梦境与信件", "多维记忆分析", "不限次数对话"],
    premiumFeatures: ["包含 Plus 全部功能", "更深入的跨维度理解", "更个性化的 Amara 成长", "更进阶的关系洞察"],
    future: "规划中",
    renewal: "Plus 月付与年付会员会自动续费，直至取消；一周体验到期不续费。",
    bottom: "不只是被记住，而是真正被理解。Amara grows with you.",
  },
} as const;

function PricingInner() {
  const { session } = useSessionContext();
  const router = useRouter();
  const params = useSearchParams();
  const initialPlan = params.get("plan");
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId | null>(isCheckoutPlanId(initialPlan) ? initialPlan : null);
  const [plans, setPlans] = useState<MembershipPlan[]>(membershipPlans(true));
  const [plusTrialEligible, setPlusTrialEligible] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const { t, locale } = useLocale();
  const copy = pageCopy[locale];

  useEffect(() => {
    let active = true;
    fetch("/api/pricing", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Pricing unavailable")))
      .then((data) => {
        if (!active || !Array.isArray(data.plans)) return;
        setPlans(data.plans);
        setPlusTrialEligible(data.plusTrialEligible === true);
      })
      .catch(() => { /* Published fallback prices remain visible. */ });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!selectedPlan) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedPlan(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedPlan]);

  const handleSelect = (planId: CheckoutPlanId) => {
    if (!session) {
      const destination = `/pricing?plan=${planId}`;
      router.push(`/login?redirectTo=${encodeURIComponent(destination)}`);
      return;
    }
    setPaymentError("");
    setSelectedPlan(planId);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };

  const plan = plans.find((item) => item.id === selectedPlan) || null;
  const plusPlan = plans.find((item) => item.id === `plus_${billing}`)!;
  const premiumPlan = plans.find((item) => item.id === `premium_${billing}`)!;
  const trial = plans.find((item) => item.id === "plus_trial")!;

  const handleCheckout = async () => {
    if (!plan || isPaying || !plan.available || plan.tier !== "plus") return;
    setIsPaying(true);
    setPaymentError("");
    void trackProductEvent("checkout_started", { locale, details: { planId: plan.id } });
    try {
      await openWaffoCheckout(plan.id, locale);
    } catch (error) {
      void trackProductEvent("checkout_failed", { locale, details: { planId: plan.id, reason: "checkout_request_failed" } });
      setPaymentError(error instanceof Error ? error.message : t.pricing.paymentInstructions);
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-[27px] tracking-[-0.04em] text-[#282621]">Amara</Link>
          <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
        </div>
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{copy.eyebrow}</p>
          <h1 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-6xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6e685f]">{copy.subtitle}</p>
        </header>

        <div className="mt-9 flex flex-col gap-5 border-y border-[#ded7cc] py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex self-start border border-[#cfc5b7] p-1" role="group" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((period) => <button key={period} type="button" onClick={() => setBilling(period)} aria-pressed={billing === period} className={`min-h-11 px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#a34f3d] ${billing === period ? "bg-[#a34f3d] text-white" : "text-[#6e685f] hover:text-[#282621]"}`}>{copy[period]}</button>)}
          </div>
          <p className="max-w-xl text-xs leading-6 text-[#817a70]">{copy.renewal}</p>
        </div>

        {plusTrialEligible && trial.available && (
          <section className="mt-10 grid gap-5 border border-[#c9ad96] bg-[#f1e5d8] px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8">
            <div><h2 className="font-serif text-2xl text-[#41352f]">{copy.trialTitle}</h2><p className="mt-2 text-sm leading-6 text-[#6e574d]">{copy.trialBody}</p></div>
            <button type="button" onClick={() => handleSelect("plus_trial")} className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#a34f3d] px-5 text-sm font-semibold text-[#8d3f30] transition-colors hover:bg-[#fff8ef] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d]">{copy.trialCta}<ArrowRight className="h-4 w-4" /></button>
          </section>
        )}

        <section className="mt-12 grid border-y border-[#d8cfc2] md:grid-cols-3 md:divide-x md:divide-[#d8cfc2]" aria-label="Membership tiers">
          <Tier name={copy.free} body={copy.freeBody} price={copy.freePrice} period="" features={copy.freeFeatures} action={<Link href={session ? "/app" : "/login?redirect=/app"} className="flex min-h-12 items-center justify-center border border-[#bdb3a5] px-4 text-sm font-semibold text-[#49453e] hover:border-[#a34f3d] hover:text-[#923f30]">{copy.freeCta}</Link>} />
          <Tier name={copy.plus} body={copy.plusBody} price={formatUsd(plusPlan.price)} period={billing === "monthly" ? copy.perMonth : copy.perYear} features={copy.plusFeatures} badge={copy.recommended} featured action={<button type="button" onClick={() => handleSelect(plusPlan.id)} className="min-h-12 w-full bg-[#a34f3d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d]">{copy.choosePlus}</button>} />
          <Tier name={copy.premium} body={copy.premiumBody} price={formatUsd(premiumPlan.price)} period={billing === "monthly" ? copy.perMonth : copy.perYear} features={copy.premiumFeatures} futureLabel={copy.future} action={<button type="button" disabled title={copy.unavailable} className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 border border-[#d8cfc2] bg-[#eee8df] px-4 text-sm font-semibold text-[#756f66]"><LockKeyhole className="h-4 w-4" />{copy.upgrading}</button>} />
        </section>
        <p className="mt-5 text-xs leading-6 text-[#817a70]">{copy.unavailable}</p>

        <p className="mt-14 text-center font-serif text-2xl leading-9 text-[#51483f]">{copy.bottom}</p>
        <p className="mt-8 text-center text-xs text-[#756f66]"><Link href="/contact" className="text-[#923f30] underline underline-offset-4">{t.pricing.contact}</Link> · {t.pricing.refundNote}</p>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-[#756f66]">
          <Link href="/terms" className="py-2 hover:text-[#923f30]">{t.login.terms}</Link><span aria-hidden="true">·</span><Link href="/privacy" className="py-2 hover:text-[#923f30]">{t.pricing.privacy}</Link><span aria-hidden="true">·</span><Link href="/cancellation" className="py-2 hover:text-[#923f30]">{t.pricing.cancelMembership}</Link><span aria-hidden="true">·</span><Link href="/content-policy" className="py-2 hover:text-[#923f30]">{t.login.contentPolicy}</Link>
        </p>
      </main>

      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#282621]/45 p-4 backdrop-blur-sm" onClick={() => setSelectedPlan(null)} role="dialog" aria-modal="true" aria-label={`${plan.name} · ${formatUsd(plan.price)} USD`}>
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto border border-[#d8cfc2] bg-[#fffdf8] p-6 text-[#282621] shadow-[12px_12px_0_#e9e1d6] sm:p-8" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label={t.pricing.close} onClick={() => setSelectedPlan(null)} className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center text-[#756f66] hover:text-[#a34f3d]"><X className="h-5 w-5" /></button>
            <div className="mb-6 text-center"><Mail className="mx-auto mb-4 h-9 w-9 text-[#a34f3d]" strokeWidth={1.5} /><h2 className="font-serif text-2xl font-semibold">{plan.name} · {formatUsd(plan.price)}</h2><p className="mt-3 text-sm font-medium text-[#413d36]">{t.pricing.paymentTitle}</p><p className="mt-2 text-xs leading-6 text-[#6e685f]">{plan.autoRenew ? t.pricing.paymentInstructions : copy.trialBody}</p></div>
            <button type="button" onClick={() => void handleCheckout()} disabled={isPaying || !plan.available} className="flex min-h-12 w-full items-center justify-center bg-[#a34f3d] px-4 text-sm font-semibold text-white transition hover:bg-[#893f31] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d] disabled:cursor-not-allowed disabled:opacity-60">{isPaying ? "…" : `${t.pricing.purchaseByEmail} · ${formatUsd(plan.price)}`}</button>
            {paymentError && <p className="mt-3 text-center text-xs leading-6 text-[#923f30]" role="alert">{paymentError}</p>}
            <div className="mt-6 border-y border-[#ded7cc] bg-[#f8f5ef] p-4"><span className="text-sm text-[#49453e]">{t.pricing.supportEmail}</span><div className="mt-2 flex flex-wrap items-center gap-2"><a href={`mailto:${SUPPORT_EMAIL}`} className="break-all py-2 font-mono text-sm text-[#923f30] hover:underline">{SUPPORT_EMAIL}</a><button type="button" onClick={copyEmail} className="flex min-h-11 items-center gap-1 px-2 text-xs text-[#6e685f] hover:text-[#923f30]"><Copy className="h-3 w-3" />{copied ? t.pricing.copied : t.pricing.copy}</button></div><p className="mt-2 text-xs leading-6 text-[#817a70]">{t.pricing.supportNote}</p></div>
            <p className="mt-4 text-center text-xs leading-6 text-[#817a70]">{plan.autoRenew ? t.pricing.activationNote : copy.renewal}</p>
            <Link href="/cancellation" className="mt-2 flex min-h-11 items-center justify-center text-xs font-semibold text-[#923f30] underline underline-offset-4">{t.pricing.cancelMembership}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Tier({ name, body, price, period, features, action, badge, featured = false, futureLabel }: { name: string; body: string; price: string; period: string; features: readonly string[]; action: React.ReactNode; badge?: string; featured?: boolean; futureLabel?: string }) {
  return (
    <article className={`relative border-b border-[#d8cfc2] px-2 py-9 last:border-b-0 md:border-b-0 md:px-8 md:py-10 ${featured ? "bg-[#f3e9de]" : ""}`}>
      {badge && <span className="absolute right-4 top-4 text-xs font-semibold text-[#923f30]">{badge}</span>}
      <h2 className="font-serif text-3xl">{name}</h2>
      <p className="mt-4 min-h-20 text-sm leading-6 text-[#6e685f]">{body}</p>
      <div className="mt-7 flex items-baseline gap-2"><span className="font-serif text-4xl font-semibold">{price}</span><span className="text-sm text-[#756f66]">{period}</span></div>
      <ul className="my-8 space-y-4 border-t border-[#d8cfc2] pt-6">{features.map((feature, index) => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[#514c44]"><Check className="mt-1 h-4 w-4 shrink-0 text-[#a34f3d]" /><span>{feature}{futureLabel && index > 0 ? <span className="ml-2 text-xs text-[#817a70]">· {futureLabel}</span> : null}</span></li>)}</ul>
      {action}
    </article>
  );
}

export default function PricingPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8f5ef] px-5 text-center text-sm text-[#756f66]">Loading pricing...</div>}><PricingInner /></Suspense>;
}
