"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowUpRight, CloudMoon, MoonStar } from "lucide-react";
import { apiRequest, Dream, ErrorState, formatDate, ImaginationLabel } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

const paperNoise = {
  backgroundImage: "radial-gradient(rgba(104, 82, 51, 0.13) 0.55px, transparent 0.75px), radial-gradient(rgba(255, 253, 247, 0.8) 0.55px, transparent 0.8px)",
  backgroundSize: "7px 7px, 11px 11px",
  backgroundPosition: "0 0, 3px 5px",
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9c624c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f7f3eb]";

export default function DreamsPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].dreams;
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ dreams: Dream[]; unavailable?: boolean }>("/api/dreams");
      setDreams(Array.isArray(result.dreams) ? result.dreams : []);
      setUnavailable(Boolean(result.unavailable));
    } catch {
      setError(locale === "zh" ? "暂时无法读取梦境，请稍后重试。" : "We couldn’t load your Dreams. Please try again.");
    } finally { setLoading(false); }
  }, [locale, session]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSkeleton(true), 300);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return (
    <>
      <header className="grid gap-6 border-b border-[#ded7cc] pb-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="max-w-3xl"><ImaginationLabel /><h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1><p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p></div>
        <Link href="/settings" className={`inline-flex min-h-11 w-fit items-center rounded-lg px-2 py-3 text-sm font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4 transition-transform duration-200 ease-out hover:-translate-y-px hover:text-[#783629] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${focusRing}`}>{copy.settings}</Link>
      </header>

      {loading ? showSkeleton ? (
        <div className="mt-8" role="status" aria-live="polite">
          <span className="sr-only">{locale === "zh" ? "正在展开晨间信笺…" : "Unfolding your morning letters…"}</span>
          <div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="relative min-h-80 animate-pulse overflow-hidden rounded-2xl border border-[#dfd2bd] bg-[#f8f1e3] p-6 shadow-[0_18px_50px_rgba(91,72,47,0.08)] motion-reduce:animate-none sm:p-8">
                <div className="absolute inset-0 opacity-30" style={paperNoise} />
                <div className="relative flex h-full min-h-64 flex-col">
                  <div className="flex items-center justify-between gap-4"><div className="h-7 w-28 rounded-full bg-[#ded3c0]" /><div className="h-6 w-6 rounded-full bg-[#ded3c0]" /></div>
                  <div className="mt-10 h-8 w-3/4 rounded-md bg-[#ded3c0]" />
                  <div className="mt-4 h-4 w-24 rounded-md bg-[#e7ddcc]" />
                  <div className="mt-6 space-y-3"><div className="h-4 w-full rounded-md bg-[#e7ddcc]" /><div className="h-4 w-11/12 rounded-md bg-[#e7ddcc]" /><div className="h-4 w-2/3 rounded-md bg-[#e7ddcc]" /></div>
                  <div className="mt-auto pt-7"><div className="h-5 w-28 rounded-md bg-[#ded3c0]" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null : error ? <ErrorState message={error} onRetry={() => void load()} /> : dreams.length === 0 ? (
        <div className="py-16 sm:py-20"><CloudMoon className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} /><h2 className="mt-5 font-serif text-3xl">{unavailable ? copy.unavailableTitle : copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{unavailable ? copy.unavailableBody : copy.emptyBody}</p></div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {dreams.map((dream) => (
            <Link key={dream.id} href={`/dreams/${encodeURIComponent(dream.id)}`} className={`group relative flex min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dfd2bd] bg-[#f8f1e3] p-6 text-[#37312a] shadow-[0_18px_50px_rgba(91,72,47,0.10),0_2px_8px_rgba(91,72,47,0.05)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#cbb99e] hover:shadow-[0_22px_55px_rgba(91,72,47,0.14),0_3px_10px_rgba(91,72,47,0.06)] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none sm:p-8 ${focusRing}`}>
              <div className="pointer-events-none absolute inset-0 opacity-30" style={paperNoise} aria-hidden="true" />
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(213,190,145,0.26)_0%,rgba(240,224,191,0.10)_48%,transparent_72%)] [animation-duration:7s] motion-reduce:animate-none" aria-hidden="true" />
              <MoonStar className="pointer-events-none absolute right-6 top-6 h-6 w-6 text-[#a88b60] sm:right-8 sm:top-8" strokeWidth={1.2} aria-hidden="true" />
              <div className="relative flex h-full flex-1 flex-col">
                <time dateTime={dream.local_date || dream.generated_at || dream.created_at} className="w-fit rounded-full border border-[#cdbca4] bg-[#fbf6ec]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#78684f] shadow-sm">{formatDate(dream.local_date || dream.generated_at || dream.created_at, false, locale)}</time>
                <h2 className="mt-9 max-w-md break-words pr-8 font-serif text-3xl leading-tight tracking-[-0.02em]">{dream.title || copy.untitled}</h2>
                {dream.emotional_theme && <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[#967054]">{dream.emotional_theme.replaceAll("_", " ")}</p>}
                <p className="mt-5 line-clamp-3 max-w-md font-serif text-base leading-8 text-[#675e50]">{dream.content}</p>
                <span className="mt-auto flex items-center justify-between gap-4 pt-7 text-xs font-semibold text-[#875440]">{copy.open}<ArrowUpRight className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-translate-y-1 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
