"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowUpRight, CloudMoon, MoonStar } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, Dream, ErrorState, formatDate, ImaginationLabel, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

const dreamPalettes = [
  "from-[#2e3239] via-[#4c4859] to-[#8b6f72]",
  "from-[#293936] via-[#49625f] to-[#a08070]",
  "from-[#363144] via-[#665573] to-[#b0837d]",
];

export default function DreamsPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].dreams;
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
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

  return (
    <AppShell>
      <header className="grid gap-6 border-b border-[#ded7cc] pb-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="max-w-3xl"><ImaginationLabel /><h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1><p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p></div>
        <Link href="/settings" className="min-h-11 py-3 text-sm font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4">{copy.settings}</Link>
      </header>

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : dreams.length === 0 ? (
        <div className="py-16 sm:py-20"><CloudMoon className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} /><h2 className="mt-5 font-serif text-3xl">{unavailable ? copy.unavailableTitle : copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{unavailable ? copy.unavailableBody : copy.emptyBody}</p></div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {dreams.map((dream, index) => (
            <Link key={dream.id} href={`/dreams/${encodeURIComponent(dream.id)}`} className={`group relative min-h-80 overflow-hidden bg-gradient-to-br ${dreamPalettes[index % dreamPalettes.length]} p-7 text-[#f8f0e7] shadow-[0_14px_35px_rgba(54,43,40,0.12)] sm:p-8`}>
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/15 transition-transform duration-700 group-hover:scale-110" aria-hidden="true" />
              <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-white/[0.06] blur-2xl" aria-hidden="true" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between gap-4"><MoonStar className="h-6 w-6 text-[#ead0b9]" strokeWidth={1.3} /><span className="text-xs text-white/60">{formatDate(dream.local_date || dream.generated_at || dream.created_at, false, locale)}</span></div>
                <h2 className="mt-10 max-w-md font-serif text-3xl leading-tight">{dream.title || copy.untitled}</h2>
                {dream.emotional_theme && <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/55">{dream.emotional_theme.replaceAll("_", " ")}</p>}
                <p className="mt-5 line-clamp-3 max-w-md font-serif text-base italic leading-8 text-white/75">{dream.content}</p>
                <span className="mt-auto flex items-center justify-between pt-7 text-xs font-semibold text-white/70">{copy.open}<ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
