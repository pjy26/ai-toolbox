"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { Compass, Fingerprint, Heart, Link2, Network, Sprout, Waves } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ErrorState, formatDate, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { relationshipCopy } from "@/lib/relationship-copy";

type DimensionId = "continuity" | "personality" | "emotions" | "values" | "growth" | "uniqueness";
type InsightDimension = { id: DimensionId; evidence: string[]; status: "waiting" | "forming" | "growing" };
type InsightsResponse = {
  companion: { id: string; name: string } | null;
  stats?: { memoryCount: number; momentCount: number; daysTogether: number };
  updatedAt?: string;
  dimensions?: InsightDimension[];
};

const icons = { continuity: Link2, personality: Fingerprint, emotions: Heart, values: Compass, growth: Sprout, uniqueness: Waves };

export default function InsightsPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = relationshipCopy[locale].insights;
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      setData(await apiRequest<InsightsResponse>(`/api/insights?locale=${locale}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setLoading(false); }
  }, [locale, session]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell>
      <header className="max-w-4xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : data?.companion && data.stats ? (
        <>
          <section className="grid grid-cols-3 divide-x divide-[#d8cfc2] border-b border-[#d8cfc2] py-7" aria-label="Relationship summary">
            <Stat value={data.stats.memoryCount} label={copy.memories} />
            <Stat value={data.stats.momentCount} label={copy.moments} />
            <Stat value={data.stats.daysTogether} label={copy.days} />
          </section>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[#817a70]">{copy.evidenceNote}{data.updatedAt ? ` ${copy.updated} ${formatDate(data.updatedAt, true, locale)}.` : ""}</p>

          <section className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-2" aria-label={copy.title}>
            {(data.dimensions || []).map((item) => {
              const Icon = icons[item.id] || Network;
              const dimensionCopy = copy.dimensions[item.id];
              return (
                <article key={item.id} className="border-t border-[#cfc5b7] pt-6">
                  <div className="flex items-start justify-between gap-5">
                    <Icon className="h-6 w-6 shrink-0 text-[#a34f3d]" strokeWidth={1.4} aria-hidden="true" />
                    <span className="text-xs font-semibold text-[#817a70]">{copy.status[item.status]}</span>
                  </div>
                  <h2 className="mt-5 font-serif text-3xl leading-tight text-[#37332d]">{dimensionCopy.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#6e685f]">{dimensionCopy.body}</p>
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94513f]">{copy.evidence}</h3>
                    {item.evidence.length ? <ul className="mt-3 space-y-3">{item.evidence.map((evidence, index) => <li key={`${item.id}-${index}`} className="border-l border-[#c9b7a8] pl-4 text-sm leading-6 text-[#49453e]">{evidence}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#756f66]">{copy.noEvidence}</p>}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      ) : (
        <div className="py-16"><Network className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} /><h2 className="mt-5 font-serif text-3xl">{copy.status.waiting}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{copy.noEvidence}</p></div>
      )}
    </AppShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="px-3 first:pl-0 last:pr-0 sm:px-7"><p className="font-serif text-3xl text-[#413b34] sm:text-4xl">{value}</p><p className="mt-2 text-xs leading-5 text-[#817a70]">{label}</p></div>;
}
