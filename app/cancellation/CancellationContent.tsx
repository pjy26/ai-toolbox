"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Mail } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/membership-plans";
import { openWaffoPortal } from "@/lib/waffo-browser";

const copy = {
  en: {
    eyebrow: "Amara membership support",
    title: "Cancel or manage your membership",
    intro: "Plus Monthly and Plus Yearly memberships renew automatically until canceled. You can stop future charges yourself in the secure customer portal—no email required. The $0.99 7-day Plus experience is a one-time payment and never renews, so there is nothing to cancel.",
    fixedTitle: "What happens when you cancel",
    fixedItems: [
      "Cancellation stops future automatic renewals; it does not end access immediately.",
      "You keep membership access until the end of the current paid billing period shown in the portal.",
      "Deleting your Amara account or stopping use does not itself cancel a subscription.",
    ],
    renewalTitle: "Self-service cancellation",
    renewalBody: "Sign in to the Amara account used for purchase, then open the customer portal. Select the subscription and choose Cancel. You can also view receipts, restore a canceled renewal, or use other available subscription controls there.",
    portalAction: "Open customer portal",
    emailAction: "Email support instead",
    emailSubject: "Amara membership cancellation support",
    emailBody: "I need help managing or canceling my Amara membership renewal.\n\nAccount email: \nPlan: \nReceipt or order reference (if available): \n\nPlease confirm the cancellation and the date my paid access ends.",
    support: "Support",
    refundsTitle: "Refunds and access after cancellation",
    refundsBody: "Cancellation and refunds are separate requests. Canceling renewal does not automatically refund a previous payment. Any available refund or statutory withdrawal right depends on the purchase terms and applicable law. Include your order reference and account email when contacting support; never send passwords or full payment-card details.",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    pricing: "current pricing",
  },
  zh: {
    eyebrow: "Amara 会员支持",
    title: "取消或管理会员",
    intro: "Plus 月付和年付会员会自动续费，直至取消。你可以在安全客户门户自行停止后续扣款，无需发送邮件。$0.99 的 7 天 Plus 体验为一次性支付，不会续费，因此无需取消。",
    fixedTitle: "取消后会发生什么",
    fixedItems: [
      "取消会停止后续自动续费，不会立即终止会员。",
      "你仍可继续使用至客户门户所示的当前已付账期结束。",
      "删除 Amara 账号或停止使用，并不等于已取消订阅。",
    ],
    renewalTitle: "自助退订",
    renewalBody: "登录购买时使用的 Amara 账号，再打开客户门户。选择对应订阅并点击取消。你也可以在门户查看收据、恢复已取消的续费，或使用其他可用的订阅管理功能。",
    portalAction: "打开客户门户",
    emailAction: "改为联系客服",
    emailSubject: "Amara 会员退订协助",
    emailBody: "我需要协助管理或取消 Amara 会员续费。\n\n账号邮箱：\n套餐：\n收据或订单编号（如有）：\n\n请确认已取消续费，并告知已付费使用的截止日期。",
    support: "客服邮箱",
    refundsTitle: "取消后的退款与使用",
    refundsBody: "退订与退款是相互独立的请求。取消续费不代表之前的付款会自动退回。可用的退款或法定撤回权取决于购买条款及适用法律。联系客服时请附上订单编号及账号邮箱；切勿发送密码或完整银行卡信息。",
    terms: "服务条款",
    privacy: "隐私政策",
    pricing: "当前价格",
  },
} as const;

export default function CancellationContent() {
  const { locale } = useLocale();
  const c = copy[locale];
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const cancellationEmail = supportMailto(c.emailSubject, c.emailBody);

  async function handlePortal() {
    if (opening) return;
    setOpening(true);
    setError("");
    try {
      await openWaffoPortal();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      setOpening(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-12 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-[27px] tracking-[-0.04em]">Amara</Link>
          <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
        </div>
        <header className="border-b border-[#d8cfc2] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{c.eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{c.title}</h1>
          <p className="mt-5 text-sm leading-7 text-[#6e685f]">{c.intro}</p>
        </header>

        <section className="border-b border-[#ded7cc] py-8" aria-labelledby="fixed-period-title">
          <h2 id="fixed-period-title" className="font-serif text-2xl font-semibold">{c.fixedTitle}</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-[#6e685f]">
            {c.fixedItems.map((item) => (
              <p key={item} className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[#a34f3d]" />{item}</p>
            ))}
          </div>
        </section>

        <section className="border-b border-[#ded7cc] py-8" aria-labelledby="renewal-title">
          <h2 id="renewal-title" className="font-serif text-2xl font-semibold">{c.renewalTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-[#6e685f]">{c.renewalBody}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void handlePortal()} disabled={opening} className="flex min-h-12 items-center justify-center gap-2 bg-[#a34f3d] px-5 text-sm font-semibold text-white transition hover:bg-[#893f31] disabled:cursor-wait disabled:opacity-60">
              <ExternalLink className="h-4 w-4" />{opening ? "…" : c.portalAction}
            </button>
            <a href={cancellationEmail} className="flex min-h-12 items-center justify-center gap-2 border border-[#cfc5b7] px-5 text-sm font-semibold text-[#6e685f] hover:text-[#923f30]">
              <Mail className="h-4 w-4" />{c.emailAction}
            </a>
          </div>
          {error && <p className="mt-3 text-sm text-[#923f30]" role="alert">{error}</p>}
          <p className="mt-4 break-all text-xs leading-6 text-[#817a70]">{c.support}: <a className="text-[#923f30] underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        </section>

        <section className="py-8" aria-labelledby="refunds-title">
          <h2 id="refunds-title" className="font-serif text-2xl font-semibold">{c.refundsTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-[#6e685f]">{c.refundsBody}</p>
        </section>

        <footer className="border border-[#d8cfc2] bg-[#fffdf8] p-5 text-sm leading-7 text-[#6e685f] shadow-[6px_6px_0_#e9e1d6]">
          <Link href="/terms" className="text-[#923f30] underline underline-offset-4">{c.terms}</Link> · <Link href="/privacy" className="text-[#923f30] underline underline-offset-4">{c.privacy}</Link> · <Link href="/pricing" className="text-[#923f30] underline underline-offset-4">{c.pricing}</Link>
        </footer>
      </main>
    </div>
  );
}
