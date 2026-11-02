"use client";

import { useEffect } from "react";
import { Mail, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

export default function LettersPage() {
  const { locale } = useLocale();
  const copy = consoleCopy[locale].letters;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("amara:letters-unread", { detail: false }));
  }, []);

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      <section className="mx-auto mt-12 max-w-2xl border border-[#ddcfc0] bg-[#fffaf1] px-7 py-12 text-center shadow-[10px_10px_0_#ece1d4] sm:px-12 sm:py-16">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0e1d4] text-[#a34f3d]">
          <Mail className="h-7 w-7" strokeWidth={1.35} />
          <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-[#b59267]" strokeWidth={1.3} />
        </div>
        <h2 className="mt-7 font-serif text-3xl leading-tight text-[#413b34]">{copy.emptyTitle}</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#6e685f]">{copy.emptyBody}</p>
        <div className="mx-auto mt-8 max-w-xs border-t border-[#e4d6c8] pt-5 font-serif text-sm italic text-[#a34f3d]">{copy.waiting}</div>
      </section>
    </AppShell>
  );
}
