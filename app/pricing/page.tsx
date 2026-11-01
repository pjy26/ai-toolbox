"use client";

import { useEffect, useState, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X, Mail, Copy } from "lucide-react";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import {
  formatUsd,
  membershipPlans,
  SUPPORT_EMAIL,
  supportMailto,
  type MembershipPlan,
  type MembershipPlanId,
} from "@/lib/membership-plans";

function PricingInner() {
  const { session } = useSessionContext();
  const router = useRouter();
  const params = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(params.get("plan"));
  const [plans, setPlans] = useState<MembershipPlan[]>(membershipPlans(true));
  const [weeklyIntroEligible, setWeeklyIntroEligible] = useState(true);
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    let active = true;
    fetch("/api/pricing", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Pricing unavailable")))
      .then((data) => {
        if (!active || !Array.isArray(data.plans)) return;
        setPlans(data.plans);
        setWeeklyIntroEligible(data.weeklyIntroEligible === true);
      })
      .catch(() => {
        // Keep the published prices visible; eligibility is confirmed again by support.
      });
    return () => { active = false; };
  }, [session?.user.id]);

  const handleSelect = (planId: MembershipPlanId) => {
    if (!session) {
      const destination = `/pricing?plan=${planId}`;
      router.push(`/login?redirectTo=${encodeURIComponent(destination)}`);
      return;
    }
    setSelectedPlan(planId);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const plan = plans.find((item) => item.id === selectedPlan);
  const planNames: Record<MembershipPlanId, string> = {
    weekly: t.pricing.weekly,
    monthly: t.pricing.monthly,
    yearly: t.pricing.yearly,
  };
  const planPeriods: Record<MembershipPlanId, string> = {
    weekly: t.pricing.perWeek,
    monthly: t.pricing.perMonth,
    yearly: t.pricing.perYear,
  };
  const planDescriptions: Record<MembershipPlanId, string> = {
    weekly: t.pricing.weeklyDescription,
    monthly: t.pricing.monthlyDescription,
    yearly: t.pricing.yearlyDescription,
  };
  const purchaseLink = plan ? supportMailto(
    `Amara ${plan.name} membership`,
    `I would like to purchase the ${plan.name} membership at ${formatUsd(plan.price)} USD.\n\nAccount email: ${session?.user.email || ""}\n\nPlease confirm the current price, availability, and cancellation terms before payment.`,
  ) : "#";

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="mb-4 flex justify-end"><LocaleToggle /></div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t.pricing.title}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">{t.pricing.subtitle}</p>
      </div>

      <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-amber-300/15 bg-amber-300/5 px-5 py-4 text-center">
        <p className="text-xs leading-relaxed text-gray-300">{t.pricing.currentAvailability}</p>
        <p className="mt-2 text-xs text-gray-500">{t.pricing.fixedAccess}</p>
      </div>

      {weeklyIntroEligible && (
        <p className="mx-auto mb-8 max-w-3xl text-center text-sm leading-6 text-brand-light" role="status">
          {t.pricing.newUserOffer}
        </p>
      )}

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            className={`relative rounded-2xl bg-surface p-7 text-center card-glow transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 ${
              item.popular ? "border-2 border-rose-400 md:-translate-y-2" : "border border-white/10"
            } ${selectedPlan === item.id ? "ring-2 ring-rose-400 ring-offset-0" : ""}`}
            aria-label={`${planNames[item.id]} · ${formatUsd(item.price)} USD`}
          >
            {item.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-400 px-3 py-0.5 text-xs font-medium text-white">
                {t.pricing.recommended}
              </span>
            )}
            <p className="text-lg font-semibold text-white">{planNames[item.id]}</p>
            <div className="mt-3 flex min-h-12 flex-wrap items-baseline justify-center gap-x-2">
              <span className="text-4xl font-bold">{formatUsd(item.price)}</span>
              <span className="text-sm text-gray-400">{planPeriods[item.id]}</span>
              {item.regularPrice && <span className="text-sm text-gray-500 line-through">{formatUsd(item.regularPrice)}</span>}
            </div>
            {item.offer === "new_user_weekly" && <p className="mt-2 text-xs font-medium text-brand-light">{t.pricing.oncePerAccount}</p>}
            <p className="mt-2 text-xs text-gray-500">{planDescriptions[item.id]}</p>
            <ul className="mt-5 space-y-2 text-left">
              {[t.pricing.unlimited, t.pricing.memories, t.pricing.anytime].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {plan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPlan(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${planNames[plan.id]} · ${formatUsd(plan.price)} USD`}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-surface-dark p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t.pricing.close}
              onClick={() => setSelectedPlan(null)}
              className="absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center text-gray-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5 text-center">
              <Mail className="mx-auto mb-3 h-10 w-10 text-rose-400" />
              <h2 className="text-xl font-bold">{planNames[plan.id]} · {formatUsd(plan.price)}</h2>
              <p className="mt-2 text-sm font-medium text-gray-200">{t.pricing.paymentTitle}</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{t.pricing.paymentInstructions}</p>
            </div>

            <a
              href={purchaseLink}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-rose-400 px-4 text-sm font-semibold text-white transition hover:bg-rose-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300"
            >
              {t.pricing.purchaseByEmail}
            </a>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-gray-300">{t.pricing.supportEmail}</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all py-2 font-mono text-base text-brand-light hover:underline">{SUPPORT_EMAIL}</a>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="flex min-h-11 items-center gap-1 px-2 text-xs text-gray-400 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? t.pricing.copied : t.pricing.copy}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">{t.pricing.supportNote}</p>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-gray-500">{t.pricing.activationNote}</p>
            <Link href="/cancellation" className="mt-3 flex min-h-11 items-center justify-center text-xs font-medium text-brand-light hover:underline">
              {t.pricing.cancelMembership}
            </Link>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-gray-500">
        {t.pricing.freeTrial} · {t.pricing.unlimitedMember} ·{" "}
        <Link href="/contact" className="text-brand-light hover:underline">{t.pricing.contact}</Link>
      </p>
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-gray-500">{t.pricing.refundNote}</p>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-gray-500">
        <Link href="/terms" className="py-2 hover:text-brand-light">{t.login.terms}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="py-2 hover:text-brand-light">{t.pricing.privacy}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/cancellation" className="py-2 hover:text-brand-light">{t.pricing.cancelMembership}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/content-policy" className="py-2 hover:text-brand-light">{t.login.contentPolicy}</Link>
      </p>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-16 text-center text-gray-500">Loading pricing...</div>}>
      <PricingInner />
    </Suspense>
  );
}
