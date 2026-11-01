import Link from "next/link";

export const metadata = { title: "Content Policy · Amara" };

const rules = [
  ["Adults only", "You must be 18 or older. Do not create sexual or romantic content involving minors, age-regression scenarios intended to sexualize minors, or content that sexualizes people in K–12 educational settings."],
  ["Consent and exploitation", "Do not use Amara to facilitate sexual exploitation, non-consensual intimate content, trafficking, stalking, coercion, blackmail, or harassment. Do not submit another person's private or intimate information without a lawful basis and appropriate permission."],
  ["Illegal or harmful activity", "Do not use the service to plan or facilitate violence, terrorism, fraud, cyber abuse, evasion of law enforcement, or other unlawful conduct. General discussion is not the same as seeking operational help to cause harm."],
  ["Self-harm and emergencies", "Amara cannot provide crisis intervention or professional care. Do not rely on it in an emergency or use it for instructions intended to enable serious harm. Contact local emergency services or a qualified human professional when immediate help is needed."],
  ["Respect and identity", "Do not use the service to promote hateful dehumanization or targeted abuse. Do not impersonate a real person to deceive others or falsely present AI-generated content as verified evidence."],
  ["Service integrity", "Do not attempt unauthorized access, scrape or disrupt the service, distribute malware, bypass security controls, or use Amara in a way that materially burdens other users or infrastructure."],
];

export default function ContentPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/" className="text-sm text-brand-light hover:underline">← Back to Amara</Link>
      <header className="mt-10 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Community safety</p>
        <h1 className="mt-3 text-3xl font-bold">Content Policy</h1>
        <p className="mt-3 text-sm text-gray-400">Effective November 1, 2026</p>
        <p className="mt-5 text-sm leading-7 text-gray-300">
          These rules apply to content you submit and how you use generated content. They support the <Link href="/terms" className="text-brand-light hover:underline">Terms of Service</Link>; examples are illustrative, not exhaustive.
        </p>
      </header>
      <div className="divide-y divide-white/10">
        {rules.map(([title, body]) => (
          <section key={title} className="py-6">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-400">{body}</p>
          </section>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold text-white">Reporting and enforcement</h2>
        <p className="mt-3 text-sm leading-7 text-gray-400">
          If you become aware of misuse, <Link href="/contact" className="text-brand-light hover:underline">contact support</Link> with enough context for review. Where reasonably necessary and permitted by law, we may reject content, restrict features, suspend an account, preserve relevant records, or report conduct to appropriate authorities. We may consider severity, context, and repeated violations.
        </p>
      </section>
    </main>
  );
}
