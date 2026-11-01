"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Mail, Heart } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const QQ = "3801434603";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  const copyQQ = async () => {
    try {
      await navigator.clipboard.writeText(QQ);
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

      <div className="bg-surface rounded-2xl p-8 border border-white/5 card-glow">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-sky-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">{t.contact.qq}</h2>
            <p className="text-gray-400 text-sm mt-1">{t.contact.fastest}</p>
            <div className="mt-3 flex items-center gap-3">
              <code className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-brand-light text-base font-mono">
                {QQ}
              </code>
              <button
                type="button"
                onClick={copyQQ}
                className="text-xs text-gray-400 hover:text-white transition"
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
        {t.contact.privacyNote} <Link href="/privacy" className="text-brand-light hover:underline">Privacy Policy</Link>
      </p>
      <p className="mt-6 text-center text-xs text-gray-500">{t.contact.responseTime}</p>
    </div>
  );
}
