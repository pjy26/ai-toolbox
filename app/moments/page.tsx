"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, Companion, ErrorState, formatDate, PageLoader, RelationshipEvent } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";
import { amaraMomentText } from "@/lib/amara-moments";

type HomeResponse = { companion: Companion | null; recentEvents: RelationshipEvent[] };

function eventText(event: RelationshipEvent) {
  return event.summary || event.content || event.description || event.title || "";
}

export default function MomentsPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].moments;
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<HomeResponse>("/api/app/home");
      setData({ companion: result.companion, recentEvents: Array.isArray(result.recentEvents) ? result.recentEvents : [] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);
  const events = data?.recentEvents || [];
  const nickname = data?.companion?.user_nickname || (locale === "zh" ? "你" : "you");

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : events.length === 0 ? (
        <div className="py-16 sm:py-20"><HeartHandshake className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} /><h2 className="mt-5 font-serif text-3xl">{copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{copy.emptyBody}</p></div>
      ) : (
        <ol className="mt-8 space-y-5">
          {events.map((event, index) => {
            const monologue = amaraMomentText(eventText(event), nickname, locale);
            return (
              <li key={event.id}>
                <article className="relative overflow-hidden border border-[#e0d4c7] bg-[#fffaf2] px-6 py-7 sm:px-9 sm:py-9">
                  <span className="absolute right-5 top-3 font-serif text-6xl italic text-[#eaded2]" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div className="relative max-w-3xl">
                    <p className="text-xs font-medium tracking-wide text-[#94513f]">{formatDate(event.occurred_at || event.created_at, false, locale)}</p>
                    <p className="mt-5 font-serif text-[1.35rem] leading-9 text-[#413b34] sm:text-2xl sm:leading-10">“{monologue}”</p>
                    <p className="mt-5 text-right font-serif text-sm italic text-[#a34f3d]">— Amara</p>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </AppShell>
  );
}
