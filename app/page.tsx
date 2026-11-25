"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowRight, Check, Eye, Lock, MoonStar, ShieldCheck, Trash2, Unlock } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { homeCopy } from "@/lib/home-copy";

const buttonMotion = "transition duration-200 ease-out hover:-translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f5ef] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

function Brand() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d] focus-visible:ring-offset-4" aria-label="Amara home">
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
  const [activeScenario, setActiveScenario] = useState(0);
  const [displayedScenario, setDisplayedScenario] = useState(0);
  const [scenarioVisible, setScenarioVisible] = useState(true);
  const [activeGraph, setActiveGraph] = useState("social-energy");
  const [isLocked, setIsLocked] = useState(true);
  const [isForgotten, setIsForgotten] = useState(false);
  const scenario = t.scenarios[displayedScenario] ?? t.scenarios[0];

  useEffect(() => {
    if (activeScenario === displayedScenario) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayedScenario(activeScenario);
      setScenarioVisible(true);
      return;
    }

    setScenarioVisible(false);
    const timer = window.setTimeout(() => {
      setDisplayedScenario(activeScenario);
      setScenarioVisible(true);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeScenario, displayedScenario]);

  const handleScenarioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % t.scenarios.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + t.scenarios.length) % t.scenarios.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = t.scenarios.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setActiveScenario(nextIndex);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[nextIndex]?.focus();
  };

  const toggleLock = () => {
    setIsLocked((locked) => !locked);
    setIsForgotten(false);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8f5ef] text-[#282621]">
      <header className="sticky top-0 z-40 border-b border-[#ded7cc]/70 bg-[#f8f5ef]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm text-[#6e685f] md:flex" aria-label={t.navAria}>
            <a href="#how-it-works" className="rounded-sm py-3 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.how}</a>
            <a href="#dreams" className="rounded-sm py-3 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.dreams}</a>
            <a href="#your-say" className="rounded-sm py-3 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.yourSay}</a>
            <Link href="/pricing" className="rounded-sm py-3 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.pricing}</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-5">
            <LocaleToggle className="!min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
            <Link href={primaryHref} className={`${buttonMotion} inline-flex min-h-11 items-center border-b border-[#a34f3d] py-3 text-sm font-semibold text-[#8e4233] hover:text-[#612c22]`}>
              {session ? t.openSpace : t.signIn}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:px-12 lg:pb-28 lg:pt-24">
          <div className="min-w-0">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#a34f3d]">{t.eyebrow}</p>
            <h1 className="max-w-xl font-serif text-[3.2rem] leading-[1.04] tracking-[-0.045em] text-[#282621] sm:text-6xl lg:text-[4.6rem]">{t.title}</h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#625d55]">{t.subtitle}</p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href={primaryHref} className={`${buttonMotion} inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-[#a34f3d] px-7 py-4 text-sm font-semibold text-white hover:bg-[#893f31] sm:w-auto`}>
                {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="min-h-11 rounded-sm px-1 py-3 text-sm font-medium text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8 transition-colors hover:decoration-[#a34f3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.seeHow}</a>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#817a70]">{t.adultNote}</p>
          </div>

          <div className="min-w-0 rounded-2xl border border-[#ded5c9] bg-[#fffdf8] p-4 shadow-[0_24px_70px_-32px_rgba(79,58,43,0.35),0_8px_24px_-16px_rgba(79,58,43,0.18)] sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-[#e8e0d6] pb-4">
              <span className="font-serif text-xl">{t.exampleTitle}</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#817a70]">{t.exampleTag}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[#f2ece3] p-1" role="group" aria-label={t.scenarioAria}>
              {t.scenarios.map((item, index) => {
                const selected = activeScenario === index;
                return (
                  <button
                    key={item.id}
                    id={`scenario-${index}`}
                    type="button"
                    aria-pressed={selected}
                    aria-controls="example-conversation"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveScenario(index)}
                    onKeyDown={(event) => handleScenarioKeyDown(event, index)}
                    className={`${buttonMotion} min-h-12 cursor-pointer rounded-lg px-1.5 py-2 text-xs font-semibold leading-4 focus-visible:ring-offset-[#f2ece3] sm:px-3 ${selected ? "bg-[#fffdf8] text-[#8e4233] shadow-sm" : "text-[#6e685f] hover:bg-[#fffdf8]/60 hover:text-[#282621]"}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div
              id="example-conversation"
              aria-live="polite"
              aria-atomic="true"
              className={`space-y-5 py-6 text-[15px] leading-7 transition-all duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none ${scenarioVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
            >
              <div className="max-w-[94%]">
                <p className="mb-1 text-xs font-semibold text-[#817a70]">{t.youYesterday}</p>
                <p>{scenario.yesterday}</p>
              </div>
              <div className="ml-auto max-w-[94%] border-l border-[#c98572] pl-4">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">{t.amaraYesterday}</p>
                <p>{scenario.yesterdayReply}</p>
              </div>
              <div className="border-t border-dashed border-[#d8cfc2] pt-5">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">{t.amaraToday}</p>
                <p>{scenario.today}</p>
              </div>
            </div>
            <p className="border-t border-[#e8e0d6] pt-4 text-xs leading-5 text-[#817a70]">{t.exampleDisclaimer}</p>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-[#ded7cc] bg-[#f1ece4]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">{t.sharedThread}</p>
                <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.continuityTitle}</h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#6e685f]">{t.continuityBody}</p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-12">
              <article className="min-w-0 rounded-2xl border border-[#ddd3c6] bg-[#fffdf8] p-5 shadow-[0_18px_50px_-36px_rgba(79,58,43,0.45)] sm:p-8 lg:col-span-7" aria-labelledby="memory-map-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{t.memoryGraph.eyebrow}</p>
                    <h3 id="memory-map-title" className="mt-3 max-w-lg font-serif text-3xl leading-tight tracking-[-0.02em]">{t.memoryGraph.title}</h3>
                  </div>
                  <Eye className="mt-1 h-6 w-6 shrink-0 text-[#a34f3d]" strokeWidth={1.4} aria-hidden="true" />
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#6e685f]">{t.memoryGraph.body}</p>
                <div className="mt-7 space-y-2" aria-label={t.memoryGraph.eyebrow}>
                  {t.memoryGraph.fragments.map((item) => {
                    const active = activeGraph === item.id;
                    return (
                      <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:gap-2">
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setActiveGraph(item.id)}
                          onMouseEnter={() => setActiveGraph(item.id)}
                          onFocus={() => setActiveGraph(item.id)}
                          className={`${buttonMotion} min-h-12 min-w-0 cursor-pointer rounded-xl border px-3 py-2 text-left text-xs leading-5 sm:text-sm ${active ? "border-[#c98572] bg-[#f6e9e1] text-[#71382c]" : "border-[#e4dcd1] bg-[#faf7f1] text-[#625d55] hover:border-[#cbbdaf]"}`}
                        >
                          {item.fragment}
                        </button>
                        <div className={`relative h-px transition-colors duration-200 ${active ? "bg-[#a34f3d]" : "bg-[#d8cfc2]"}`} aria-hidden="true">
                          <span className={`absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-colors duration-200 ${active ? "bg-[#a34f3d]" : "bg-[#d8cfc2]"}`} />
                        </div>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setActiveGraph(item.id)}
                          onMouseEnter={() => setActiveGraph(item.id)}
                          onFocus={() => setActiveGraph(item.id)}
                          className={`${buttonMotion} min-h-12 min-w-0 cursor-pointer rounded-xl border px-3 py-2 text-left text-xs font-semibold leading-5 sm:text-sm ${active ? "border-[#a34f3d] bg-[#a34f3d] text-[#fffaf3] shadow-[0_8px_20px_-12px_rgba(163,79,61,0.8)]" : "border-[#ded5c9] text-[#625d55] hover:border-[#a34f3d]"}`}
                        >
                          {item.node}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-6 border-t border-[#e8e0d6] pt-4 text-xs leading-5 text-[#817a70]">{t.memoryGraph.footnote}</p>
              </article>

              <article id="dreams" className="relative min-w-0 scroll-mt-24 overflow-hidden rounded-2xl bg-[#292d2b] p-5 text-[#f6f0e7] shadow-[0_18px_50px_-36px_rgba(41,45,43,0.8)] sm:p-8 lg:col-span-5" aria-labelledby="nightly-dream-title">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#d8a78f]/15 blur-3xl animate-pulse [animation-duration:6s] motion-reduce:animate-none" aria-hidden="true" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8a78f]">Nightly Dream</p>
                    <MoonStar className="h-6 w-6 shrink-0 text-[#d8a78f]" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3 id="nightly-dream-title" className="mt-4 font-serif text-3xl leading-tight tracking-[-0.02em]">{t.dreamsTitle}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#dcd7ce]">{t.dreamsBody1}</p>
                  <div className="mt-6 rounded-xl border border-[#e2d7c9] bg-[#f6f0e7] p-5 text-[#38352f] shadow-[0_16px_35px_-20px_rgba(0,0,0,0.45)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8e4233]">{t.dreamTag}</p>
                    <h4 className="mt-3 font-serif text-2xl">{t.dreamTitle}</h4>
                    <p className="mt-3 text-sm leading-7 text-[#625d55]">{t.dreamBody}</p>
                    <p className="mt-4 border-t border-[#d8cfc2] pt-3 text-xs leading-5 text-[#756f66]">{t.dreamFootnote}</p>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#c9c5bc]">{t.dreamsBody2}</p>
                </div>
              </article>

              <article id="your-say" className="min-w-0 scroll-mt-24 rounded-2xl border border-[#d8cbbb] bg-[#efe7dc] p-5 sm:p-8 lg:col-span-5" aria-labelledby="your-say-title">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{t.memoryEyebrow}</p>
                <h3 id="your-say-title" className="mt-3 font-serif text-3xl leading-tight tracking-[-0.02em]">{t.memoryTitle}</h3>
                <div className="mt-5 divide-y divide-[#d8cbbb] border-y border-[#d8cbbb]">
                  {t.controls.map(([title, body], index) => {
                    const FeatureIcon = featureIcons[index];
                    return (
                      <div key={title} className="flex gap-3 py-4">
                        <FeatureIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#a34f3d]" strokeWidth={1.6} aria-hidden="true" />
                        <div>
                          <h4 className="text-sm font-semibold">{title}</h4>
                          <p className="mt-1 text-xs leading-5 text-[#6e685f]">{body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 space-y-4" aria-describedby="local-demo-note">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 gap-2">
                      {isLocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#a34f3d]" aria-hidden="true" /> : <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-[#a34f3d]" aria-hidden="true" />}
                      <div>
                        <p id="lock-demo-label" className="text-sm font-semibold">{t.lockLabel}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6e685f]">{isLocked ? t.locked : t.unlocked}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLocked}
                      aria-labelledby="lock-demo-label"
                      onClick={toggleLock}
                      className={`${buttonMotion} flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full`}
                    >
                      <span className={`relative block h-7 w-12 rounded-full transition-colors ${isLocked ? "bg-[#a34f3d]" : "bg-[#b8aea1]"}`}>
                        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-[#fffaf3] shadow-sm transition-transform duration-200 motion-reduce:transition-none ${isLocked ? "translate-x-5" : "translate-x-0"}`} />
                      </span>
                    </button>
                  </div>

                  <div className={`flex items-center justify-between gap-4 ${isLocked ? "opacity-55" : "opacity-100"}`}>
                    <div>
                      <p id="forget-demo-label" className="text-sm font-semibold">{t.forgetLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6e685f]">{isForgotten ? t.forgetOn : t.forgetOff}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isForgotten}
                      aria-labelledby="forget-demo-label"
                      disabled={isLocked}
                      onClick={() => setIsForgotten((forgotten) => !forgotten)}
                      className={`${buttonMotion} flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100`}
                    >
                      <span className={`relative block h-7 w-12 rounded-full transition-colors ${isForgotten ? "bg-[#a34f3d]" : "bg-[#b8aea1]"}`}>
                        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-[#fffaf3] shadow-sm transition-transform duration-200 motion-reduce:transition-none ${isForgotten ? "translate-x-5" : "translate-x-0"}`} />
                      </span>
                    </button>
                  </div>

                  <p className={`rounded-xl border border-[#d8cbbb] bg-[#f8f3eb] px-4 py-3 text-sm leading-6 transition-opacity duration-200 motion-reduce:transition-none ${isForgotten ? "text-[#817a70]" : "text-[#4f4a43]"}`} aria-live="polite">
                    {isForgotten ? t.previewForgotten : t.previewMemory}
                  </p>
                  <p id="local-demo-note" className="text-xs leading-5 text-[#756f66]">{t.localDemo}</p>
                </div>
              </article>

              <div className="min-w-0 rounded-2xl border border-[#ddd3c6] bg-[#f8f5ef] p-5 sm:p-8 lg:col-span-7">
                <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
                  {t.pillars.map((pillar, index) => (
                    <article key={pillar.title} className={`border-t border-[#d8cfc2] pt-4 ${index === t.pillars.length - 1 ? "sm:col-span-2" : ""}`}>
                      <h3 className="font-serif text-xl">{pillar.title}</h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[#6e685f]">{pillar.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-3 border-t border-[#d2c6b7] pt-6 text-sm leading-7 text-[#625d55] sm:grid-cols-3 sm:gap-8">
              {t.assurances.map((item) => <p key={item} className="flex items-start gap-2"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#a34f3d]" aria-hidden="true" />{item}</p>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="privacy-promise" className="border-b border-[#ded7cc] bg-[#292d2b] text-[#f6f0e7]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-12 lg:py-20">
            <div>
              <ShieldCheck className="h-7 w-7 text-[#d8a78f]" strokeWidth={1.5} aria-hidden="true" />
              <h2 id="privacy-promise" className="mt-5 max-w-xl font-serif text-4xl leading-tight tracking-[-0.03em]">{t.privacyTitle}</h2>
            </div>
            <div>
              <p className="max-w-2xl text-base leading-8 text-[#dcd7ce]">{t.privacyBody}</p>
              <ul className="mt-6 grid gap-3 text-sm text-[#f6f0e7] sm:grid-cols-3">
                {t.privacyPoints.map((item) => <li key={item} className="flex items-start gap-2 border-t border-[#525652] pt-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[#d8a78f]" aria-hidden="true" />{item}</li>)}
              </ul>
              <p className="mt-6 text-sm font-medium text-[#d8a78f]">{t.freeTrial}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <p className="font-serif text-lg text-[#a34f3d]">{t.quote}</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">{t.closingTitle}</h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#6e685f]">{t.closingBody}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={primaryHref} className={`${buttonMotion} inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-[#a34f3d] px-8 py-4 text-sm font-semibold text-white hover:bg-[#893f31] sm:w-auto`}>
              {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className={`${buttonMotion} inline-flex min-h-11 items-center rounded-sm px-4 py-3 text-sm font-semibold text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8`}>{t.viewPricing}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ded7cc]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-xs text-[#756f66] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Brand />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/privacy" className="rounded-sm py-2 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.privacy}</Link>
            <Link href="/terms" className="rounded-sm py-2 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.terms}</Link>
            <Link href="/cancellation" className="rounded-sm py-2 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.cancellation}</Link>
            <Link href="/content-policy" className="rounded-sm py-2 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.contentPolicy}</Link>
            <Link href="/contact" className="rounded-sm py-2 transition-colors hover:text-[#282621] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a34f3d]">{t.contact}</Link>
          </div>
          <p>© Amara</p>
        </div>
      </footer>
    </div>
  );
}
