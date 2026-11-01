"use client";

import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const copy = {
  en: {
    eyebrow: "Amara legal",
    title: "Terms of Service",
    effective: "Effective November 1, 2026",
    introBefore: "By creating an account or using Amara, you agree to these terms and the ",
    contentPolicy: "Content Policy",
    introAfter: ". If you do not agree, do not use the service.",
    footer: "Questions about these terms or a purchase? Email",
    cancellation: "Cancellation options",
    privacy: "Privacy Policy",
    sections: [
      {
        title: "Eligibility and accounts",
        body: "You must be at least 18 years old to use Amara. You are responsible for providing accurate account information, protecting your credentials, and activity performed through your account. Contact support if you believe your account has been accessed without authorization.",
      },
      {
        title: "An AI companion, not a human or professional",
        body: "Amara is an AI. It does not have human consciousness, lived experiences, or independent real-world relationships. Responses, memories, relationship events, and Dreams may be incomplete or wrong. Dreams are imaginative content and are not facts about you or predictions. Amara is not a medical, mental-health, legal, or financial professional and is not an emergency or crisis service. Seek qualified human help when appropriate.",
      },
      {
        title: "Acceptable use",
        body: "You must follow the Content Policy and applicable law. Do not use the service to harm, exploit, deceive, or harass others; facilitate illegal activity; violate privacy or intellectual-property rights; attempt unauthorized access; or interfere with the service. We may restrict access or remove content where reasonably necessary to protect users, the service, or others, subject to applicable law.",
      },
      {
        title: "Memberships, prices, and payment",
        body: "Memberships are displayed and charged in US dollars (USD): Weekly is $1.99, Monthly is $3.99, and Yearly is $29.90. While the launch offer is available, an eligible new account may purchase its first Weekly membership for $0.99, once per account. Current memberships provide access for a fixed period and do not automatically renew. Purchases currently begin through support email. Confirm the price, activation timing, and exact access period before sending payment. Never send passwords or full payment-card details by email.",
      },
      {
        title: "Cancellation and refunds",
        body: "A current fixed-period membership simply expires at the end of its paid access period, so no action is needed to prevent renewal. If a receipt or future checkout expressly shows automatic renewal, follow the cancellation instructions shown there or email support from your account email before the next renewal. Cancellation stops future renewals; access normally continues through the already-paid period. Cancellation is not automatically a refund. Any refund or statutory withdrawal right depends on the applicable purchase terms and law; contact support before payment if you need clarification. See the Cancellation page for current options.",
      },
      {
        title: "Your content and generated content",
        body: "You retain whatever rights you hold in content you submit. You give Amara permission to process that content as needed to operate, secure, and improve the service. You are responsible for having the right to submit it. AI output may not be unique and its legal ownership can depend on applicable law. Do not rely on generated content as an authoritative record without checking it.",
      },
      {
        title: "Availability and changes",
        body: "Features, AI models, memory behavior, and availability may change. We may need to suspend the service for maintenance, security, provider outages, or other operational reasons. We do not guarantee uninterrupted service, perfectly accurate recall, or permanent retention. We may update these terms and will show a revised effective date when we do.",
      },
      {
        title: "Disclaimers and liability",
        body: "To the extent permitted by applicable law, Amara is provided on an “as available” basis, without warranties that are not expressly stated. Nothing in these terms excludes rights, guarantees, or liabilities that cannot legally be excluded. You remain responsible for decisions you make based on generated content.",
      },
    ],
  },
  zh: {
    eyebrow: "Amara 法律条款",
    title: "服务条款",
    effective: "生效日期：2026 年 11 月 1 日",
    introBefore: "创建账号或使用 Amara，即表示你同意本条款及",
    contentPolicy: "内容政策",
    introAfter: "。如你不同意，请勿使用本服务。",
    footer: "对本条款或购买有疑问？请发送邮件至",
    cancellation: "退订说明",
    privacy: "隐私政策",
    sections: [
      {
        title: "使用资格与账号",
        body: "你必须年满 18 周岁方可使用 Amara。你应提供准确的账号信息、保护登录凭据，并对通过你的账号进行的活动负责。如你认为账号被未经授权访问，请联系客服。",
      },
      {
        title: "AI 伴侣，并非真人或专业人士",
        body: "Amara 是 AI，不具备人类意识、真实生活经历或独立的现实人际关系。回复、记忆、关系事件及梦境可能不完整或存在错误。梦境属于想象性内容，不是关于你的事实或预测。Amara 不是医疗、心理健康、法律或金融专业人士，也不是紧急或危机援助服务。如有需要，请寻求合适的真人专业帮助。",
      },
      {
        title: "可接受的使用方式",
        body: "你必须遵守内容政策及适用法律。不得利用本服务伤害、剥削、欺骗或骚扰他人，协助违法活动，侵犯隐私或知识产权，尝试未经授权的访问，或干扰服务运行。在适用法律允许的范围内，为保护用户、服务或他人而确有必要时，我们可能限制访问或移除内容。",
      },
      {
        title: "会员、价格与付款",
        body: "会员以美元（USD）展示和收费：周卡 $1.99、月卡 $3.99、年卡 $29.90。新客优惠可用期间，符合条件的新账号可以 $0.99 购买首个周卡，每个账号仅一次。当前会员在固定期限内有效，不会自动续费。目前购买通过客服邮件发起。付款前请确认价格、开通时间及准确的有效期。切勿通过邮件发送密码或完整的银行卡信息。",
      },
      {
        title: "退订与退款",
        body: "当前固定期限会员会在已付费有效期结束时自然到期，无需操作即可避免续费。如果收据或未来的收银台明确显示自动续费，请按照其中的取消说明操作，或在下次续费前使用账号邮箱联系客服。取消会停止后续续费，通常可继续使用至已付期限结束。取消不等于自动退款。任何退款或法定撤回权均取决于适用的购买条款及法律；如需说明，请在付款前联系客服。当前可选方式请参见退订说明页面。",
      },
      {
        title: "你的内容与生成内容",
        body: "你保留对提交内容所拥有的权利。你授权 Amara 为运营、保障安全和改进服务所需处理这些内容，并应确保自己有权提交。AI 输出可能并非独一无二，其法律权属可能取决于适用法律。未经核实，请勿将生成内容视为权威记录。",
      },
      {
        title: "服务可用性与变更",
        body: "功能、AI 模型、记忆行为及服务可用性可能发生变化。我们可能因维护、安全、服务商故障或其他运营原因暂停服务。我们不保证服务永不中断、回忆完全准确或数据永久保留。我们可能更新本条款，并在更新时展示新的生效日期。",
      },
      {
        title: "免责声明与责任",
        body: "在适用法律允许的范围内，Amara 按“实际可用”状态提供，不作未明确声明的保证。本条款不排除依法不得排除的权利、保证或责任。你仍需对基于生成内容作出的决定负责。",
      },
    ],
  },
} as const;

export default function TermsContent() {
  const { locale } = useLocale();
  const c = copy[locale];

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
          <p className="mt-4 text-sm text-[#817a70]">{c.effective}</p>
          <p className="mt-5 text-sm leading-7 text-[#6e685f]">
            {c.introBefore}<Link href="/content-policy" className="text-[#923f30] underline underline-offset-4">{c.contentPolicy}</Link>{c.introAfter}
          </p>
        </header>
        <div className="divide-y divide-[#ded7cc]">
          {c.sections.map((section, index) => (
            <section key={section.title} className="py-7">
              <h2 className="font-serif text-xl font-semibold">{index + 1}. {section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6e685f]">{section.body}</p>
            </section>
          ))}
        </div>
        <footer className="mt-6 border border-[#d8cfc2] bg-[#fffdf8] p-5 text-sm leading-7 text-[#6e685f] shadow-[6px_6px_0_#e9e1d6]">
          {c.footer} <a href="mailto:admin@amarapjy.xyz" className="break-all text-[#923f30] underline underline-offset-4">admin@amarapjy.xyz</a>.{" "}
          <Link href="/cancellation" className="text-[#923f30] underline underline-offset-4">{c.cancellation}</Link> · <Link href="/privacy" className="text-[#923f30] underline underline-offset-4">{c.privacy}</Link>
        </footer>
      </main>
    </div>
  );
}
