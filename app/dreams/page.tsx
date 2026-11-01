"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowUpRight, CloudMoon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, Dream, ErrorState, formatDate, ImaginationLabel, PageLoader } from "@/components/amara-ui";

export default function DreamsPage() {
  const { session } = useSessionContext();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ dreams: Dream[]; unavailable?: boolean }>("/api/dreams");
      setDreams(Array.isArray(result.dreams) ? result.dreams : []);
      setUnavailable(Boolean(result.unavailable));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <header className="grid gap-6 border-b border-[#ded7cc] pb-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="max-w-3xl">
          <ImaginationLabel />
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Dreams</h1>
          <p className="mt-4 text-sm leading-7 text-[#6e685f]">
            Small works of imagination inspired by real conversations. They’re kept apart from your factual memories, and never ask anything of you.
          </p>
        </div>
        <Link href="/settings" className="min-h-11 py-3 text-sm font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4">Dream settings</Link>
      </header>

      {loading ? <PageLoader label="Opening the dream journal…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : dreams.length === 0 ? (
        <div className="py-16 sm:py-20">
          <CloudMoon className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} aria-hidden="true" />
          <h2 className="mt-5 font-serif text-3xl">{unavailable ? "Dream storage isn’t available yet." : "No Dreams have gathered yet."}</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">
            {unavailable ? "The rest of your space remains available. Dream storage needs to be enabled before entries can appear here." : "Some nights stay quiet. When a meaningful conversation inspires a Dream, it will appear here. You can change this anytime in Settings."}
          </p>
        </div>
      ) : (
        <ol className="mt-3">
          {dreams.map((dream, index) => (
            <li key={dream.id} className="border-b border-[#ded7cc]">
              <Link href={`/dreams/${encodeURIComponent(dream.id)}`} className="group grid gap-4 py-7 sm:grid-cols-[110px_1fr_auto] sm:gap-7 sm:py-9">
                <div className="flex items-center justify-between sm:block">
                  <p className="text-xs font-medium text-[#817a70]">{formatDate(dream.local_date || dream.generated_at || dream.created_at)}</p>
                  <span className="font-serif text-xs italic text-[#b3a99c] sm:mt-2 sm:block">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <h2 className="font-serif text-2xl leading-tight text-[#37332d] group-hover:text-[#923f30] sm:text-3xl">{dream.title || "An untitled Dream"}</h2>
                  {dream.emotional_theme && <p className="mt-2 text-xs font-medium capitalize text-[#a34f3d]">{dream.emotional_theme.replaceAll("_", " ")}</p>}
                  <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-7 text-[#6e685f]">{dream.content}</p>
                </div>
                <ArrowUpRight className="hidden h-5 w-5 text-[#a34f3d] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
