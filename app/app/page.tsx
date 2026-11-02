"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowRight, BookOpen, ChevronRight, CloudMoon, Crown, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, Companion, Dream, ErrorState, formatDate, getLiveState, ImaginationLabel, isFreshState, Memory, PageLoader, RelationshipEvent } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";
import { amaraMomentText } from "@/lib/amara-moments";
import { displayMemoryText } from "@/lib/memory-display";

type HomeResponse = {
  companion: Companion | null;
  membership: { isMember: boolean; membershipType: string | null; expiresAt: string | null };
  latestDream: Dream | null;
  recentMemories: Memory[];
  recentEvents: RelationshipEvent[];
};

function eventText(event: RelationshipEvent) {
  return event.summary || event.content || event.description || event.title || null;
}

export default function DashboardPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].today;
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<HomeResponse>("/api/app/home");
      setData({
        companion: result.companion,
        membership: result.membership,
        latestDream: result.latestDream || null,
        recentMemories: Array.isArray(result.recentMemories) ? result.recentMemories : [],
        recentEvents: Array.isArray(result.recentEvents) ? result.recentEvents : [],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : data?.companion ? <DashboardContent data={data} /> : (
        <div className="py-16 text-center">
          <h1 className="font-serif text-4xl">{copy.startTitle}</h1>
          <p className="mt-4 text-[#6e685f]">{copy.noCompanion}</p>
          <Link href="/chat" className="mt-7 inline-flex min-h-12 items-center bg-[#a34f3d] px-6 text-sm font-semibold text-white">{copy.start}</Link>
        </div>
      )}
    </AppShell>
  );
}

function DashboardContent({ data }: { data: HomeResponse }) {
  const { locale } = useLocale();
  const copy = consoleCopy[locale].today;
  const { companion, membership, latestDream, recentMemories, recentEvents } = data;
  if (!companion) return null;
  const name = companion.companion_name || "Amara";
  const liveState = getLiveState(companion.live_state);
  const fresh = isFreshState(liveState.updatedAt, companion.last_active_at);
  // A milestone is not an ongoing topic. Only the recorded live topic belongs here.
  const previousThread = liveState.lastTopic;
  const previousThreadDate = liveState.updatedAt || companion.last_active_at;
  const planNames = locale === "zh" ? { weekly: "周卡", monthly: "月卡", yearly: "年卡" } : { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
  const membershipLabel = membership.isMember ? `${planNames[membership.membershipType as keyof typeof planNames] || "Amara"} ${copy.member}` : copy.free;
  const stage = typeof companion.relationship_stage === "number"
    ? (locale === "zh" ? `第 ${companion.relationship_stage} 章` : `Chapter ${companion.relationship_stage}`)
    : typeof companion.relationship_stage === "string" && companion.relationship_stage.trim()
      ? companion.relationship_stage.replaceAll("_", " ")
      : copy.ongoing;

  return (
    <>
      <section className="relative overflow-hidden border border-[#dccfc0] bg-[#eee2d5] px-6 py-9 sm:px-10 sm:py-12">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-[#c8a894]/50 sm:right-8" aria-hidden="true" />
        <div className="absolute -right-1 -top-3 h-28 w-28 rounded-full border border-[#c8a894]/40 sm:right-12" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.19em] text-[#94513f]">{companion.user_nickname ? `${copy.welcome}, ${companion.user_nickname}` : copy.welcome}</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${membership.isMember ? "border-[#c8a265] bg-[#fff7e6] text-[#805a25]" : "border-[#d8cfc2] bg-[#fffdf8] text-[#756f66]"}`} title={membership.expiresAt ? `${locale === "zh" ? "有效期至" : "Valid until"} ${formatDate(membership.expiresAt, true, locale)}` : membershipLabel}>
              {membership.isMember && <Crown className="h-3.5 w-3.5" aria-hidden="true" />}{membershipLabel}
            </span>
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">{copy.title}</h1>
          <div className="mt-6 flex items-center gap-3 text-sm text-[#6e574d]"><span className="font-medium text-[#41352f]">{name}</span><span aria-hidden="true">·</span><span className="capitalize">{stage}</span></div>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#66574f]">
            {fresh && liveState.text ? liveState.text : liveState.text ? `${copy.lastTime} ${liveState.text}` : companion.last_active_at ? `${copy.lastConnected} ${formatDate(companion.last_active_at, true, locale)}. ${copy.pickUp}` : copy.noWords}
          </p>
          <Link href={`/chat?role=${encodeURIComponent(companion.relationship_type)}`} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[#9e4837] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#833a2c] sm:w-auto">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />{copy.continue} {name}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {previousThread && (
        <section className="border-b border-[#ded7cc] py-8 sm:py-10" aria-labelledby="last-thread-title">
          <div className="flex items-center justify-between gap-4"><h2 id="last-thread-title" className="text-xs font-semibold uppercase tracking-[0.17em] text-[#817a70]">{copy.thread}</h2><span className="text-xs text-[#817a70]">{formatDate(previousThreadDate, false, locale)}</span></div>
          <Link href={`/chat?role=${encodeURIComponent(companion.relationship_type)}`} className="group mt-4 flex items-center justify-between gap-5"><p className="max-w-3xl font-serif text-2xl leading-8 text-[#37332d] group-hover:text-[#923f30] sm:text-3xl sm:leading-10">{previousThread}</p><ChevronRight className="h-5 w-5 shrink-0 text-[#a34f3d]" aria-hidden="true" /></Link>
        </section>
      )}

      <div className="grid lg:grid-cols-2 lg:gap-x-12">
        <section className="border-b border-[#ded7cc] py-9 sm:py-10">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xs font-semibold uppercase tracking-[0.17em] text-[#817a70]">{copy.latestDream}</h2><Link href="/dreams" className="min-h-11 py-3 text-xs font-semibold text-[#923f30] hover:underline">{copy.allDreams}</Link></div>
          {latestDream ? (
            <Link href={`/dreams/${latestDream.id}`} className="group block pt-3"><ImaginationLabel /><h3 className="mt-4 font-serif text-3xl leading-tight text-[#37332d] group-hover:text-[#923f30]">{latestDream.title || consoleCopy[locale].dreams.untitled}</h3><p className="mt-3 line-clamp-3 text-sm leading-7 text-[#6e685f]">{latestDream.content}</p><p className="mt-4 text-xs text-[#817a70]">{formatDate(latestDream.local_date || latestDream.generated_at || latestDream.created_at, false, locale)}</p></Link>
          ) : (
            <div className="pt-5"><CloudMoon className="h-6 w-6 text-[#a98a78]" strokeWidth={1.4} /><p className="mt-4 font-serif text-2xl">{copy.quietNight}</p><p className="mt-2 max-w-md text-sm leading-6 text-[#6e685f]">{copy.quietBody}</p></div>
          )}
        </section>

        <section className="border-b border-[#ded7cc] py-9 sm:py-10">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xs font-semibold uppercase tracking-[0.17em] text-[#817a70]">{copy.remembered}</h2><Link href="/memories" className="min-h-11 py-3 text-xs font-semibold text-[#923f30] hover:underline">{copy.review}</Link></div>
          {recentMemories.length > 0 ? (
            <ul className="mt-2 divide-y divide-[#e4ddd3]">{recentMemories.slice(0, 3).map((memory) => <li key={memory.id} className="py-4"><p className="text-sm leading-6 text-[#49453e]">{displayMemoryText(memory.summary, locale)}</p><p className="mt-1 text-xs text-[#817a70]">{copy.updated} {formatDate(memory.updated_at || memory.created_at, false, locale)}</p></li>)}</ul>
          ) : (
            <div className="pt-5"><BookOpen className="h-6 w-6 text-[#a98a78]" strokeWidth={1.4} /><p className="mt-4 font-serif text-2xl">{copy.nothingSaved}</p><p className="mt-2 max-w-md text-sm leading-6 text-[#6e685f]">{copy.nothingBody}</p></div>
          )}
        </section>
      </div>

      <section className="py-9 sm:py-10">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-xs font-semibold uppercase tracking-[0.17em] text-[#817a70]">{copy.moments}</h2><p className="mt-3 font-serif text-3xl">{copy.momentsTitle}</p></div><Link href="/moments" className="min-h-11 py-3 text-xs font-semibold text-[#923f30] hover:underline">{copy.moments}</Link></div>
        {recentEvents.length > 0 ? (
          <ol className="mt-7 border-l border-[#cfc5b7] pl-6 sm:ml-2">{recentEvents.slice(0, 5).map((event) => <li key={event.id} className="relative pb-7 last:pb-0"><span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#f8f5ef] bg-[#a34f3d] ring-1 ring-[#a34f3d]" /><p className="text-xs text-[#817a70]">{formatDate(event.occurred_at || event.created_at, false, locale)}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[#49453e]">{amaraMomentText(eventText(event), companion.user_nickname || (locale === "zh" ? "你" : "you"), locale) || event.event_type?.replaceAll("_", " ")}</p></li>)}</ol>
        ) : <p className="mt-6 border-t border-[#ded7cc] pt-6 text-sm leading-6 text-[#6e685f]">{copy.noMoments}</p>}
      </section>
    </>
  );
}
