import Link from "next/link";

export const metadata = { title: "Terms of Service · Amara" };

const sections = [
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
    title: "Memberships and manual payment",
    body: "The plans currently displayed are fixed-period memberships priced in CNY and paid through Alipay. Support activates membership manually after reviewing payment confirmation, so activation is not instant. Amara does not automatically renew these plans. International cards and Stripe checkout are not currently available. Confirm the current payment and refund terms with support before paying; nothing on this page creates a refund promise not otherwise required by applicable law.",
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
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/" className="text-sm text-brand-light hover:underline">← Back to Amara</Link>
      <header className="mt-10 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Legal</p>
        <h1 className="mt-3 text-3xl font-bold">Terms of Service</h1>
        <p className="mt-3 text-sm text-gray-400">Effective November 1, 2026</p>
        <p className="mt-5 text-sm leading-7 text-gray-300">
          By creating an account or using Amara, you agree to these terms and the <Link href="/content-policy" className="text-brand-light hover:underline">Content Policy</Link>. If you do not agree, do not use the service.
        </p>
      </header>
      <div className="divide-y divide-white/10">
        {sections.map((section, index) => (
          <section key={section.title} className="py-7">
            <h2 className="text-lg font-semibold text-white">{index + 1}. {section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-400">{section.body}</p>
          </section>
        ))}
      </div>
      <footer className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-gray-300">
        Questions about these terms or a purchase? <Link href="/contact" className="text-brand-light hover:underline">Contact support</Link>.
      </footer>
    </main>
  );
}
