"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Heart } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/membership-plans";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-12 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-[27px] tracking-[-0.04em]">Amara</Link>
          <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
        </div>
        <div className="mb-10 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">Amara support</p>
          <h1 className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{t.contact.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#6e685f]">{t.contact.subtitle}</p>
        </div>

        <div className="border border-[#d8cfc2] bg-[#fffdf8] p-6 shadow-[8px_8px_0_#e9e1d6] sm:p-8">
          <div className="flex items-start gap-4">
            <Mail className="mt-1 h-7 w-7 shrink-0 text-[#a34f3d]" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl font-semibold">{t.contact.email}</h2>
              <p className="mt-2 text-sm text-[#6e685f]">{t.contact.fastest}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a href={supportMailto("Amara support", "Please describe your request here.\n\nAccount email: ")} className="break-all py-2 font-mono text-sm text-[#923f30] underline underline-offset-4 sm:text-base">
                  {SUPPORT_EMAIL}
                </a>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="min-h-11 px-2 text-xs font-medium text-[#6e685f] hover:text-[#923f30]"
                >
                  {copied ? t.contact.copied : t.contact.copy}
                </button>
              </div>
              <p className="mt-3 text-xs leading-6 text-[#817a70]">{t.contact.requestNote}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="border-t border-[#d8cfc2] py-6">
            <Mail className="mb-3 h-6 w-6 text-[#a34f3d]" strokeWidth={1.5} />
            <h3 className="font-serif text-xl font-semibold">{t.contact.partnerships}</h3>
            <p className="mt-2 text-xs leading-6 text-[#6e685f]">{t.contact.partnershipsText}</p>
          </div>
          <div className="border-t border-[#d8cfc2] py-6">
            <Heart className="mb-3 h-6 w-6 text-[#a34f3d]" strokeWidth={1.5} />
            <h3 className="font-serif text-xl font-semibold">{t.contact.feedback}</h3>
            <p className="mt-2 text-xs leading-6 text-[#6e685f]">{t.contact.feedbackText}</p>
          </div>
        </div>

        <p className="mt-8 border-y border-[#ded7cc] bg-[#f1ece4] p-5 text-xs leading-6 text-[#6e685f]">
          {t.contact.privacyNote} <Link href="/privacy" className="font-medium text-[#923f30] underline underline-offset-4">{t.pricing.privacy}</Link>
        </p>
        <p className="mt-4 text-center text-xs">
          <Link href="/cancellation" className="inline-flex min-h-11 items-center font-medium text-[#923f30] underline underline-offset-4">{t.pricing.cancelMembership}</Link>
        </p>
        <p className="mt-4 text-center text-xs leading-6 text-[#817a70]">{t.contact.responseTime}</p>
      </div>
    </div>
  );
}
