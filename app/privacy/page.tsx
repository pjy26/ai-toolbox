import Link from "next/link";

export const metadata = { title: "Privacy Policy · Amara" };

const sections = [
  {
    title: "Information we process",
    paragraphs: [
      "Amara processes the account information you provide, such as your email address, password credentials handled by our authentication provider, and optional nickname. Legacy accounts may use a phone-derived login identifier.",
      "To provide ongoing companionship, we process conversations, relationship events, companion settings, saved memories, and generated Dream entries. A Dream is generated fiction or reflection, not a factual record of you.",
      "If you contact support or make a manual payment, we may process the messages and payment confirmation you choose to send. Do not send passwords, full payment credentials, or unnecessary sensitive information.",
    ],
  },
  {
    title: "How we use information",
    paragraphs: [
      "We use this information to authenticate your account, provide and personalize conversations, generate and display memories and Dreams, maintain security, respond to support requests, and administer memberships.",
      "AI-generated content can be inaccurate. Memory controls let you review, edit, or delete saved memories and delete Dreams through the product when those features are available.",
    ],
  },
  {
    title: "Service providers and transfers",
    paragraphs: [
      "We rely on infrastructure and AI providers to operate Amara, including Supabase for application data and authentication, DeepSeek for conversation generation, and an embedding provider for memory retrieval. These providers process relevant data for us under their own terms and safeguards.",
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
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/" className="text-sm text-brand-light hover:underline">← Back to Amara</Link>
      <header className="mt-10 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Legal</p>
        <h1 className="mt-3 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-gray-400">Effective November 1, 2026</p>
        <p className="mt-5 text-sm leading-7 text-gray-300">
          This policy explains how Amara handles information when you use the service. It is written to describe the current product, including its limitations.
        </p>
      </header>
      <div className="divide-y divide-white/10">
        {sections.map((section) => (
          <section key={section.title} className="py-7">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-7 text-gray-400">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
      <footer className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-gray-300">
        Questions or privacy requests? <Link href="/contact" className="text-brand-light hover:underline">Contact support</Link>. Include your account email, but never your password.
      </footer>
    </main>
  );
}
