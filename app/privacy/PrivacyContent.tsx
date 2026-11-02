"use client";

import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const copy = {
  en: {
    eyebrow: "Amara legal",
    title: "Privacy Policy",
    effective: "Effective November 1, 2026",
    intro: "This policy explains how Amara handles information when you use the service. It is written to describe the current product, including its limitations.",
    footer: "Questions or privacy requests? Email",
    footerAfter: "Include your account email, but never your password.",
    terms: "Terms of Service",
    sections: [
      {
        title: "Information we process",
        paragraphs: [
          "Amara processes the account information you provide, such as your email address, password credentials handled by our authentication provider, and optional nickname. Legacy accounts may use a phone-derived login identifier.",
          "To provide ongoing companionship, we process conversations, relationship events, companion settings, saved memories, and generated Dream entries. A Dream is generated fiction or reflection, not a factual record of you.",
          "If you contact support or purchase a membership, we may process your support emails, account identifier, selected plan, order and payment status, access period, and payment confirmation you choose to provide. Payment providers may process transaction information under their own privacy terms. Never email passwords or full payment-card details, and avoid sending unnecessary sensitive information.",
        ],
      },
      {
        title: "How we use information",
        paragraphs: [
          "We use this information to authenticate your account, provide and personalize conversations, generate and display memories and Dreams, maintain security, respond to support requests, and administer memberships.",
          "AI-generated content can be inaccurate. Memory controls let you review or delete saved memories and delete Dreams through the product when those features are available.",
        ],
      },
      {
        title: "Service providers and transfers",
        paragraphs: [
          "We rely on infrastructure and AI providers to operate Amara, including Supabase for application data and authentication, DeepSeek for conversation generation, an embedding provider for memory retrieval, and Waffo Pancake for hosted checkout, subscription management, and content-safety scanning. Relevant prompts and generated text are sent for safety review; Waffo states that its prompt scan is stateless. Payment details are handled by the checkout provider, and we receive order, payment status, subscription, and access-period records rather than your full card credentials.",
          "Using an online service may involve processing in countries other than your own. The locations and legal safeguards involved depend on the providers used to deliver the service.",
        ],
      },
      {
        title: "Retention, security, and your choices",
        paragraphs: [
          "We retain information for as long as reasonably needed to provide the service, maintain security, resolve disputes, and meet applicable obligations. Retention periods can vary by data type and backup cycle. We do not promise permanent memory or immediate erasure from every backup.",
          "We use reasonable safeguards, but no online service can guarantee absolute security or absolute privacy. Avoid sharing information that you would not want processed by an AI service.",
          "You may contact us to ask about access, correction, or deletion of account data. Self-service account deletion and full data export are not currently available, so some requests require manual handling. We may need to verify account ownership before completing a request.",
        ],
      },
      {
        title: "Age and policy updates",
        paragraphs: [
          "Amara is intended only for adults aged 18 or older. It is not directed to children, and you should not create an account if you are under 18.",
          "We may update this policy as the service changes. The effective date above identifies the current version. Continued use after an update is subject to the revised policy.",
        ],
      },
    ],
  },
  zh: {
    eyebrow: "Amara 法律条款",
    title: "隐私政策",
    effective: "生效日期：2026 年 11 月 1 日",
    intro: "本政策说明你在使用服务时，Amara 如何处理相关信息，并如实描述当前产品的功能及限制。",
    footer: "有疑问或隐私请求？请发送邮件至",
    footerAfter: "请附上账号邮箱，但切勿提供密码。",
    terms: "服务条款",
    sections: [
      {
        title: "我们处理的信息",
        paragraphs: [
          "Amara 会处理你提供的账号信息，例如邮箱地址、由身份验证服务商处理的密码凭据，以及可选昵称。早期账号可能使用由手机号生成的登录标识。",
          "为提供持续的陪伴，我们会处理对话、关系事件、伴侣设置、已保存的记忆及生成的梦境内容。梦境是生成的虚构或反思内容，不是关于你的事实记录。",
          "当你联系客服或购买会员时，我们可能处理客服邮件、账号标识、所选套餐、订单与付款状态、有效期，以及你选择提供的付款确认信息。支付服务商可能依据其自身隐私条款处理交易信息。切勿通过邮件发送密码或完整银行卡信息，也请避免发送不必要的敏感信息。",
        ],
      },
      {
        title: "我们如何使用信息",
        paragraphs: [
          "我们使用这些信息验证账号、提供并个性化对话、生成和展示记忆与梦境、维护安全、回应客服请求及管理会员。",
          "AI 生成内容可能不准确。相关功能可用时，你可以通过产品中的记忆管理功能查看或删除已保存的记忆，并删除梦境。",
        ],
      },
      {
        title: "服务商与跨境传输",
        paragraphs: [
          "我们依靠基础设施及 AI 服务商运营 Amara，包括由 Supabase 提供应用数据和身份验证服务、DeepSeek 生成对话、嵌入模型服务商支持记忆检索，以及 Waffo Pancake 提供托管收银台、订阅管理和内容安全扫描。相关输入及生成文本会发送至安全审核；Waffo 表示其文本扫描为无状态处理。支付信息由收银台服务商处理，我们接收订单、付款状态、订阅及有效期记录，而不会接收你的完整银行卡凭据。",
          "使用在线服务可能涉及在你的所在国家或地区之外处理信息。具体处理地点和法律保障措施取决于提供服务所使用的服务商。",
        ],
      },
      {
        title: "数据保留、安全与你的选择",
        paragraphs: [
          "我们会在提供服务、维护安全、解决争议及履行适用义务所合理需要的期限内保留信息。保留期限可能因数据类型和备份周期而异。我们不承诺记忆永久保留，也不承诺所有备份中的数据会立即删除。",
          "我们采取合理的安全保障措施，但任何在线服务都无法保证绝对安全或绝对隐私。请避免分享你不希望由 AI 服务处理的信息。",
          "你可以联系我们，请求访问、更正或删除账号数据。目前不提供自助删除账号和完整数据导出，因此部分请求需要人工处理。完成请求前，我们可能需要验证账号归属。",
        ],
      },
      {
        title: "年龄要求与政策更新",
        paragraphs: [
          "Amara 仅供年满 18 周岁的成年人使用，不面向儿童。未满 18 周岁者不应创建账号。",
          "随着服务变化，我们可能更新本政策。上方生效日期标识当前版本。更新后继续使用服务，将适用修订后的政策。",
        ],
      },
    ],
  },
} as const;

export default function PrivacyContent() {
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
          <p className="mt-5 text-sm leading-7 text-[#6e685f]">{c.intro}</p>
        </header>
        <div className="divide-y divide-[#ded7cc]">
          {c.sections.map((section) => (
            <section key={section.title} className="py-7">
              <h2 className="font-serif text-xl font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-[#6e685f]">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <footer className="mt-6 border border-[#d8cfc2] bg-[#fffdf8] p-5 text-sm leading-7 text-[#6e685f] shadow-[6px_6px_0_#e9e1d6]">
          {c.footer} <a href="mailto:admin@amarapjy.xyz" className="break-all text-[#923f30] underline underline-offset-4">admin@amarapjy.xyz</a>. {c.footerAfter}{" "}
          <Link href="/terms" className="text-[#923f30] underline underline-offset-4">{c.terms}</Link>
        </footer>
      </main>
    </div>
  );
}
