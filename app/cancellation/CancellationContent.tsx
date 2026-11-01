"use client";

import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/membership-plans";

const copy = {
  en: {
    eyebrow: "Amara membership support",
    title: "Cancellation options",
    intro: "You can end a membership without contacting us when it is fixed-period. If your purchase expressly includes automatic renewal, email support to cancel future charges.",
    fixedTitle: "Current fixed-period memberships",
    fixedItems: [
      "Weekly, Monthly, and Yearly memberships currently do not automatically renew.",
      "No cancellation action is needed. Your membership simply ends when its paid access period expires.",
      "Not renewing or deleting your account does not automatically create a refund.",
    ],
    renewalTitle: "If your purchase shows automatic renewal",
    renewalBody: "Follow the cancellation link in your receipt or checkout if one is provided. Otherwise, email us from your account email before the next renewal and include your plan and receipt or order reference. We will confirm the request by email. Cancellation stops future renewals; paid access normally remains available until the end of the current paid period.",
    emailAction: "Email a cancellation request",
    emailSubject: "Amara membership cancellation",
    emailBody: "I would like to cancel any automatic renewal associated with my Amara membership.\n\nAccount email: \nPlan: \nReceipt or order reference (if available): \n\nPlease confirm the cancellation and the date my paid access ends.",
    support: "Support",
    refundsTitle: "Refunds and access after cancellation",
    refundsBody: "Cancellation and refunds are separate requests. A cancellation does not automatically refund a payment. Any available refund or statutory withdrawal right depends on the terms shown for your purchase and applicable law. Contact support before purchasing if you need the terms clarified. For an existing order, include your order reference and account email; never send passwords or full payment-card details.",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    pricing: "current pricing",
  },
  zh: {
    eyebrow: "Amara 会员支持",
    title: "退订说明",
    intro: "固定期限会员到期后会自然结束，无需联系我们。如果你的购买明确包含自动续费，可通过客服邮件取消后续扣款。",
    fixedTitle: "当前固定期限会员",
    fixedItems: [
      "当前周卡、月卡及年卡均不会自动续费。",
      "无需进行取消操作，会员会在已付费有效期结束时自然到期。",
      "不再续费或删除账号，均不代表会自动产生退款。",
    ],
    renewalTitle: "如果你的购买显示自动续费",
    renewalBody: "如果收据或收银台提供取消链接，请按链接操作。否则，请在下次续费前使用账号邮箱联系我们，并附上套餐、收据或订单编号。我们会通过邮件确认请求。取消会停止后续续费，通常仍可继续使用至当前已付期限结束。",
    emailAction: "发送退订申请邮件",
    emailSubject: "Amara 会员退订申请",
    emailBody: "我希望取消 Amara 会员可能关联的任何自动续费。\n\n账号邮箱：\n套餐：\n收据或订单编号（如有）：\n\n请确认已取消续费，并告知已付费使用的截止日期。",
    support: "客服邮箱",
    refundsTitle: "取消后的退款与使用",
    refundsBody: "退订与退款是相互独立的请求。取消续费不代表已支付款项会自动退回。可用的退款或法定撤回权取决于购买时展示的条款及适用法律。如需说明，请在购买前联系客服。已有订单请附上订单编号及账号邮箱；切勿发送密码或完整银行卡信息。",
    terms: "服务条款",
    privacy: "隐私政策",
    pricing: "当前价格",
  },
} as const;

export default function CancellationContent() {
  const { locale } = useLocale();
  const c = copy[locale];
  const cancellationEmail = supportMailto(c.emailSubject, c.emailBody);

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
          <a href={cancellationEmail} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-[#a34f3d] px-5 text-sm font-semibold text-white transition hover:bg-[#893f31] sm:inline-flex sm:w-auto">
            <Mail className="h-4 w-4" />{c.emailAction}
          </a>
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
