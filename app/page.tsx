"use client";

import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowRight, Check, MoonStar, Eye, ShieldCheck, Trash2 } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { homeCopy } from "@/lib/home-copy";

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Amara home">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#a34f3d]" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-[#a34f3d]" />
      </span>
      <span className="font-serif text-[27px] tracking-[-0.04em] text-[#282621]">Amara</span>
    </Link>
  );
}

export default function HomePage() {
  const { session, isLoading } = useSessionContext();
  const { locale } = useLocale();
  const t = homeCopy[locale];
  const primaryHref = session ? "/app" : "/login?redirect=/app";
  const primaryLabel = isLoading ? t.meet : session ? t.return : t.meet;
  const featureIcons = [Eye, Trash2, ShieldCheck];

  return (
    <div className="bg-[#f8f5ef] text-[#282621]">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="hidden items-center gap-8 text-sm text-[#6e685f] md:flex" aria-label={t.navAria}>
          <a href="#how-it-works" className="hover:text-[#282621]">{t.how}</a>
          <a href="#dreams" className="hover:text-[#282621]">{t.dreams}</a>
          <a href="#your-say" className="hover:text-[#282621]">{t.yourSay}</a>
          <Link href="/pricing" className="hover:text-[#282621]">{t.pricing}</Link>
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
          <Link href={primaryHref} className="min-h-11 border-b border-[#a34f3d] py-3 text-sm font-semibold text-[#8e4233] hover:text-[#612c22]">
            {session ? t.openSpace : t.signIn}
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:px-12 lg:pb-28 lg:pt-24">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#a34f3d]">{t.eyebrow}</p>
            <h1 className="max-w-xl font-serif text-[3.2rem] leading-[1.04] tracking-[-0.045em] text-[#282621] sm:text-6xl lg:text-[4.6rem]">{t.title}</h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#625d55]">{t.subtitle}</p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href={primaryHref} className="inline-flex min-h-13 w-full items-center justify-center gap-3 bg-[#a34f3d] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] sm:w-auto">
                {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="min-h-11 px-1 py-3 text-sm font-medium text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8 hover:decoration-[#a34f3d]">{t.seeHow}</a>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#817a70]">{t.adultNote}</p>
          </div>

          <div className="relative border border-[#d8cfc2] bg-[#fffdf8] p-5 shadow-[12px_12px_0_#e9e1d6] sm:p-8">
            <div className="flex items-center justify-between gap-3 border-b border-[#e3dcd1] pb-4">
              <span className="font-serif text-xl">{t.exampleTitle}</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#817a70]">{t.exampleTag}</span>
            </div>
            <div className="space-y-6 py-7 text-[15px] leading-7">
              <div className="max-w-[88%]">
                <p className="mb-1 text-xs font-semibold text-[#817a70]">{t.youYesterday}</p>
                <p>{t.exampleUser}</p>
              </div>
              <div className="ml-auto max-w-[88%] border-l-2 border-[#c98572] pl-4">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">Amara</p>
                <p>{t.exampleAssistant1}</p>
              </div>
              <div className="border-t border-dashed border-[#d8cfc2] pt-6">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">{t.amaraToday}</p>
                <p>{t.exampleAssistant2}</p>
              </div>
            </div>
            <p className="border-t border-[#e3dcd1] pt-4 text-xs leading-5 text-[#817a70]">{t.exampleDisclaimer}</p>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[#ded7cc] bg-[#f1ece4]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24 lg:px-12 lg:py-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{t.sharedThread}</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.continuityTitle}</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#6e685f]">{t.continuityBody}</p>
            </div>
            <ol className="divide-y divide-[#d5ccbf] border-y border-[#d5ccbf]">
              {t.steps.map(([number, title, body]) => (
                <li key={number} className="grid gap-3 py-7 sm:grid-cols-[48px_1fr] sm:py-8">
                  <span className="font-serif text-sm italic text-[#a34f3d]">{number}</span>
                  <div>
                    <h3 className="font-serif text-2xl">{title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-[#6e685f]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="dreams" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-24 lg:px-12 lg:py-28">
          <div className="order-2 lg:order-1">
            <div className="bg-[#292d2b] p-7 text-[#f6f0e7] sm:p-10">
              <div className="flex items-center justify-between gap-3">
                <MoonStar className="h-6 w-6 shrink-0 text-[#d8a78f]" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9c5bc]">{t.dreamTag}</span>
              </div>
              <h3 className="mt-10 font-serif text-3xl">{t.dreamTitle}</h3>
              <p className="mt-5 text-[15px] leading-8 text-[#dcd7ce]">{t.dreamBody}</p>
              <div className="mt-8 border-t border-[#525652] pt-5 text-xs leading-6 text-[#b9b7b0]">{t.dreamFootnote}</div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{t.dreamsEyebrow}</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.dreamsTitle}</h2>
            <p className="mt-5 text-base leading-8 text-[#6e685f]">{t.dreamsBody1}</p>
            <p className="mt-4 text-base leading-8 text-[#6e685f]">{t.dreamsBody2}</p>
          </div>
        </section>

        <section id="your-say" className="border-y border-[#ded7cc] bg-[#efe7dc]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{t.memoryEyebrow}</p>
                <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.memoryTitle}</h2>
              </div>
              <div className="divide-y divide-[#d2c6b7] border-y border-[#d2c6b7]">
                {t.controls.map(([title, body], index) => {
                  const FeatureIcon = featureIcons[index];
                  return (
                    <div key={title} className="flex gap-5 py-6">
                      <FeatureIcon className="mt-1 h-5 w-5 shrink-0 text-[#a34f3d]" strokeWidth={1.6} aria-hidden="true" />
                      <div>
                        <h3 className="font-medium">{title}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#6e685f]">{body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-12 flex flex-col gap-3 border-l-2 border-[#a34f3d] pl-5 text-sm leading-7 text-[#625d55] sm:flex-row sm:gap-10">
              {t.assurances.map((item) => <p key={item} className="flex items-start gap-2"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#a34f3d]" />{item}</p>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <p className="font-serif text-lg italic text-[#a34f3d]">{t.quote}</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">{t.closingTitle}</h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#6e685f]">{t.closingBody}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={primaryHref} className="inline-flex min-h-13 w-full items-center justify-center gap-3 bg-[#a34f3d] px-8 py-4 text-sm font-semibold text-white hover:bg-[#893f31] sm:w-auto">
              {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="min-h-11 px-4 py-3 text-sm font-semibold text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8">{t.viewPricing}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ded7cc]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-xs text-[#756f66] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Brand />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/privacy" className="hover:text-[#282621]">{t.privacy}</Link>
            <Link href="/terms" className="hover:text-[#282621]">{t.terms}</Link>
            <Link href="/cancellation" className="hover:text-[#282621]">{t.cancellation}</Link>
            <Link href="/content-policy" className="hover:text-[#282621]">{t.contentPolicy}</Link>
            <Link href="/contact" className="hover:text-[#282621]">{t.contact}</Link>
          </div>
          <p>© Amara</p>
        </div>
      </footer>
    </div>
  );
}
