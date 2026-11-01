import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/membership-plans";

export const metadata = { title: "Cancellation · Amara" };

export default function CancellationPage() {
  const cancellationEmail = supportMailto(
    "Amara membership cancellation",
    "I would like to cancel any automatic renewal associated with my Amara membership.\n\nAccount email: \nPlan: \nReceipt or order reference (if available): \n\nPlease confirm the cancellation and the date my paid access ends.",
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/" className="text-sm text-brand-light hover:underline">← Back to Amara</Link>
      <header className="mt-10 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Membership support</p>
        <h1 className="mt-3 text-3xl font-bold">Cancellation options</h1>
        <p className="mt-5 text-sm leading-7 text-gray-300">
          You can end a membership without contacting us when it is fixed-period. If your purchase expressly includes automatic renewal, email support to cancel future charges.
        </p>
      </header>

      <section className="border-b border-white/10 py-8" aria-labelledby="fixed-period-title">
        <h2 id="fixed-period-title" className="text-xl font-semibold text-white">Current fixed-period memberships</h2>
        <div className="mt-5 space-y-3 text-sm leading-7 text-gray-400">
          <p className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-green-400" />Weekly, Monthly, and Yearly memberships currently do not automatically renew.</p>
          <p className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-green-400" />No cancellation action is needed. Your membership simply ends when its paid access period expires.</p>
          <p className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-green-400" />Not renewing or deleting your account does not automatically create a refund.</p>
        </div>
      </section>

      <section className="border-b border-white/10 py-8" aria-labelledby="renewal-title">
        <h2 id="renewal-title" className="text-xl font-semibold text-white">If your purchase shows automatic renewal</h2>
        <p className="mt-4 text-sm leading-7 text-gray-400">
          Follow the cancellation link in your receipt or checkout if one is provided. Otherwise, email us from your account email before the next renewal and include your plan and receipt or order reference. We will confirm the request by email. Cancellation stops future renewals; paid access normally remains available until the end of the current paid period.
        </p>
        <a href={cancellationEmail} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-400 px-5 text-sm font-semibold text-white hover:bg-rose-300 sm:inline-flex sm:w-auto">
          <Mail className="h-4 w-4" />Email a cancellation request
        </a>
        <p className="mt-4 break-all text-xs leading-6 text-gray-500">Support: <a className="text-brand-light hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </section>

      <section className="py-8" aria-labelledby="refunds-title">
        <h2 id="refunds-title" className="text-xl font-semibold text-white">Refunds and access after cancellation</h2>
        <p className="mt-4 text-sm leading-7 text-gray-400">
          Cancellation and refunds are separate requests. A cancellation does not automatically refund a payment. Any available refund or statutory withdrawal right depends on the terms shown for your purchase and applicable law. Contact support before purchasing if you need the terms clarified. For an existing order, include your order reference and account email; never send passwords or full payment-card details.
        </p>
      </section>

      <footer className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-gray-300">
        Review the <Link href="/terms" className="text-brand-light hover:underline">Terms of Service</Link>, <Link href="/privacy" className="text-brand-light hover:underline">Privacy Policy</Link>, or <Link href="/pricing" className="text-brand-light hover:underline">current pricing</Link>.
      </footer>
    </main>
  );
}
