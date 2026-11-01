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
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="flex justify-end mb-4"><LocaleToggle /></div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">{t.contact.title}</h1>
        <p className="text-gray-400 mt-3 text-sm leading-relaxed">{t.contact.subtitle}</p>
      </div>

      <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-white/5 card-glow">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white">{t.contact.email}</h2>
            <p className="text-gray-400 text-sm mt-1">{t.contact.fastest}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={supportMailto("Amara support", "Please describe your request here.\n\nAccount email: ")} className="break-all py-2 text-brand-light text-base font-mono hover:underline">
                {SUPPORT_EMAIL}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="min-h-11 px-2 text-xs text-gray-400 hover:text-white transition"
              >
                {copied ? t.contact.copied : t.contact.copy}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">{t.contact.requestNote}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5">
          <Mail className="w-6 h-6 text-brand mb-2" />
          <h3 className="font-semibold text-sm">{t.contact.partnerships}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t.contact.partnershipsText}</p>
        </div>
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5">
          <Heart className="w-6 h-6 text-rose-400 mb-2" />
          <h3 className="font-semibold text-sm">{t.contact.feedback}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t.contact.feedbackText}</p>
        </div>
      </div>

      <p className="mt-8 rounded-xl border border-white/5 bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
        {t.contact.privacyNote} <Link href="/privacy" className="text-brand-light hover:underline">{t.pricing.privacy}</Link>
      </p>
      <p className="mt-4 text-center text-xs text-gray-500">
        <Link href="/cancellation" className="text-brand-light hover:underline">{t.pricing.cancelMembership}</Link>
      </p>
      <p className="mt-6 text-center text-xs text-gray-500">{t.contact.responseTime}</p>
    </div>
  );
}
