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
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-12 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-[27px] tracking-[-0.04em] text-[#282621]">Amara</Link>
          <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
        </div>
        <div className="mb-10 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">Amara membership</p>
          <h1 className="font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.pricing.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#6e685f]">{t.pricing.subtitle}</p>
        </div>

        <div className="mx-auto mb-8 max-w-3xl border-y border-[#ded7cc] bg-[#f1ece4] px-5 py-4 text-center">
          <p className="text-xs leading-6 text-[#625d55]">{t.pricing.currentAvailability}</p>
          <p className="mt-2 text-xs leading-6 text-[#817a70]">{t.pricing.fixedAccess}</p>
        </div>

        {weeklyIntroEligible && (
          <p className="mx-auto mb-10 max-w-3xl text-center text-sm font-medium leading-6 text-[#923f30]" role="status">
            {t.pricing.newUserOffer}
          </p>
        )}

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-5">
          {plans.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`relative bg-[#fffdf8] p-7 text-center transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d] ${
                item.popular ? "border-2 border-[#a34f3d] shadow-[8px_8px_0_#e4d5c8]" : "border border-[#d8cfc2] shadow-[8px_8px_0_#e9e1d6]"
              } ${selectedPlan === item.id ? "ring-2 ring-[#a34f3d] ring-offset-4 ring-offset-[#f8f5ef]" : ""}`}
              aria-label={`${planNames[item.id]} · ${formatUsd(item.price)} USD`}
            >
              {item.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#a34f3d] px-3 py-1 text-xs font-semibold text-white">
                  {t.pricing.recommended}
                </span>
              )}
              <p className="font-serif text-2xl text-[#282621]">{planNames[item.id]}</p>
              <div className="mt-4 flex min-h-12 flex-wrap items-baseline justify-center gap-x-2">
                <span className="font-serif text-4xl font-semibold">{formatUsd(item.price)}</span>
                <span className="text-sm text-[#756f66]">{planPeriods[item.id]}</span>
                {item.regularPrice && <span className="text-sm text-[#817a70] line-through">{formatUsd(item.regularPrice)}</span>}
              </div>
              {item.offer === "new_user_weekly" && <p className="mt-3 text-xs font-semibold leading-5 text-[#923f30]">{t.pricing.oncePerAccount}</p>}
              <p className="mt-3 min-h-5 text-xs text-[#817a70]">{planDescriptions[item.id]}</p>
              <ul className="mt-6 space-y-3 border-t border-[#e3dcd1] pt-5 text-left">
                {[t.pricing.unlimited, t.pricing.memories, t.pricing.anytime].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-[#625d55]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a34f3d]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {plan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#282621]/45 p-4 backdrop-blur-sm"
            onClick={() => setSelectedPlan(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${planNames[plan.id]} · ${formatUsd(plan.price)} USD`}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-md overflow-y-auto border border-[#d8cfc2] bg-[#fffdf8] p-6 text-[#282621] shadow-[12px_12px_0_#e9e1d6] sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label={t.pricing.close}
                onClick={() => setSelectedPlan(null)}
                className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center text-[#756f66] hover:text-[#a34f3d]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 text-center">
                <Mail className="mx-auto mb-4 h-9 w-9 text-[#a34f3d]" strokeWidth={1.5} />
                <h2 className="font-serif text-2xl font-semibold">{planNames[plan.id]} · {formatUsd(plan.price)}</h2>
                <p className="mt-3 text-sm font-medium text-[#413d36]">{t.pricing.paymentTitle}</p>
                <p className="mt-2 text-xs leading-6 text-[#6e685f]">{t.pricing.paymentInstructions}</p>
              </div>

              <a
                href={purchaseLink}
                className="flex min-h-12 w-full items-center justify-center bg-[#a34f3d] px-4 text-sm font-semibold text-white transition hover:bg-[#893f31] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d]"
              >
                {t.pricing.purchaseByEmail}
              </a>

              <div className="mt-6 border-y border-[#ded7cc] bg-[#f8f5ef] p-4">
                <span className="text-sm text-[#49453e]">{t.pricing.supportEmail}</span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all py-2 font-mono text-sm text-[#923f30] hover:underline">{SUPPORT_EMAIL}</a>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="flex min-h-11 items-center gap-1 px-2 text-xs text-[#6e685f] hover:text-[#923f30]"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? t.pricing.copied : t.pricing.copy}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-6 text-[#817a70]">{t.pricing.supportNote}</p>
              </div>

              <p className="mt-4 text-center text-xs leading-6 text-[#817a70]">{t.pricing.activationNote}</p>
              <Link href="/cancellation" className="mt-2 flex min-h-11 items-center justify-center text-xs font-semibold text-[#923f30] underline underline-offset-4">
                {t.pricing.cancelMembership}
              </Link>
            </div>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-[#756f66]">
          {t.pricing.freeTrial} · {t.pricing.unlimitedMember} ·{" "}
          <Link href="/contact" className="text-[#923f30] underline underline-offset-4">{t.pricing.contact}</Link>
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-6 text-[#817a70]">{t.pricing.refundNote}</p>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-[#756f66]">
          <Link href="/terms" className="py-2 hover:text-[#923f30]">{t.login.terms}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="py-2 hover:text-[#923f30]">{t.pricing.privacy}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cancellation" className="py-2 hover:text-[#923f30]">{t.pricing.cancelMembership}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/content-policy" className="py-2 hover:text-[#923f30]">{t.login.contentPolicy}</Link>
        </p>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8f5ef] px-5 text-center text-sm text-[#756f66]">Loading pricing...</div>}>
      <PricingInner />
    </Suspense>
  );
}
