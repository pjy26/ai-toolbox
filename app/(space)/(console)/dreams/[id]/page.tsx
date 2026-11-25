"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowLeft, ChevronDown, Feather, MoonStar, Trash2 } from "lucide-react";
import { apiRequest, ConfirmDialog, Dream, ErrorState, formatDate, ImaginationLabel } from "@/components/amara-ui";
import { useCompanionSpace } from "@/components/companion-space";
import { useLocale } from "@/components/locale-provider";

const detailCopy = {
  en: {
    allDreams: "All Dreams",
    opening: "Opening this Dream…",
    untitled: "An untitled Dream",
    about: "A Dream about",
    disclaimer: "This is a creative reflection, not something that happened. Nothing in this Dream becomes a factual memory about you.",
    threads: "Real threads behind the imagination",
    sourceOne: "Generated from 1 real conversation thread or saved moment.",
    sourceMany: "Generated from {count} real conversation threads and saved moments.",
    sourceZeroTitle: "Creative imagination",
    sourceZero: "This Dream was not generated from a real conversation or saved moment. It is simply a work of imagination.",
    review: "Review saved memories",
    settings: "Turn off future Dreams in Settings",
    delete: "Delete this Dream",
    confirmTitle: "Delete this Dream?",
    confirmDescription: (title: string) => `“${title}” will be removed from your Dream journal. This can’t be undone.`,
    confirmLabel: "Delete Dream",
    loadError: "We couldn’t open this Dream. Please try again.",
    deleteError: "The Dream couldn’t be deleted. Please try again.",
  },
  zh: {
    allDreams: "全部梦境",
    opening: "正在打开这场梦…",
    untitled: "一场无题的梦",
    about: "一场关于",
    disclaimer: "这是一段创意想象，不是真实发生的事。梦境中的任何内容都不会成为关于你的事实记忆。",
    threads: "想象背后的真实线索",
    sourceOne: "这场梦基于1 条真实对话或已保存片段生成。",
    sourceMany: "这场梦基于{count} 条真实对话或已保存片段生成。",
    sourceZeroTitle: "创意想象",
    sourceZero: "这场梦并非基于真实对话或已保存片段生成，而是一段纯粹的创意想象。",
    review: "查看已保存的记忆",
    settings: "在设置中关闭以后的梦境",
    delete: "删除这场梦",
    confirmTitle: "删除这场梦？",
    confirmDescription: (title: string) => `“${title}”将从你的梦境典藏中移除，且无法恢复。`,
    confirmLabel: "删除梦境",
    loadError: "暂时无法打开这场梦，请稍后重试。",
    deleteError: "暂时无法删除这场梦，请稍后重试。",
  },
};

const paperNoise = {
  backgroundImage: "radial-gradient(rgba(104, 82, 51, 0.13) 0.55px, transparent 0.75px), radial-gradient(rgba(255, 253, 247, 0.8) 0.55px, transparent 0.8px)",
  backgroundSize: "7px 7px, 11px 11px",
  backgroundPosition: "0 0, 3px 5px",
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9c624c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f7f3eb]";

export default function DreamDetailPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = detailCopy[locale];
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const activeId = useCompanionSpace().profiles?.activeCompanionId;
  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    if (!session || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ dream: Dream & { companion_id: string } }>(`/api/dreams/${encodeURIComponent(id)}`);
      if (result.dream.companion_id !== activeId) {
        router.replace("/dreams");
        return;
      }
      setDream(result.dream);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [activeId, copy.loadError, id, router, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSkeleton(true), 300);
    return () => window.clearTimeout(timer);
  }, [loading]);

  async function removeDream() {
    if (!dream || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/api/dreams/${encodeURIComponent(dream.id)}`, { method: "DELETE" });
      router.replace("/dreams");
    } catch {
      setDeleteError(copy.deleteError);
      setConfirming(false);
      setDeleting(false);
    }
  }

  const sourceCount = dream
    ? (dream.source_message_ids?.length || 0) + (dream.source_memory_ids?.length || 0) + (dream.source_event_ids?.length || 0)
    : 0;
  const sourceDescription = (sourceCount === 1 ? copy.sourceOne : copy.sourceMany).replace("{count}", String(sourceCount));

  return (
    <>
      <Link href="/dreams" className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#6e685f] transition-[transform,color] duration-200 ease-out hover:-translate-y-px hover:text-[#923f30] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${focusRing}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{copy.allDreams}
      </Link>

      {deleteError && <div className="mt-5 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{deleteError}</div>}

      {loading ? showSkeleton ? (
        <div className="mx-auto max-w-3xl pt-8 sm:pt-12" role="status" aria-live="polite">
          <span className="sr-only">{copy.opening}</span>
          <div className="relative animate-pulse overflow-hidden rounded-2xl border border-[#dfd2bd] bg-[#faf4e8] px-5 py-7 shadow-[0_22px_60px_rgba(91,72,47,0.10)] motion-reduce:animate-none sm:px-10 sm:py-12 lg:px-14" aria-hidden="true">
            <div className="absolute inset-0 opacity-30" style={paperNoise} />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4"><div className="h-4 w-36 rounded-md bg-[#ded3c0]" /><div className="h-7 w-32 rounded-full bg-[#ded3c0]" /></div>
              <div className="mt-8 h-10 w-4/5 rounded-md bg-[#ded3c0] sm:h-14" />
              <div className="mt-4 h-5 w-40 rounded-md bg-[#e7ddcc]" />
              <div className="space-y-5 py-10 sm:py-12"><div className="h-5 w-full rounded-md bg-[#e7ddcc]" /><div className="h-5 w-11/12 rounded-md bg-[#e7ddcc]" /><div className="h-5 w-full rounded-md bg-[#e7ddcc]" /><div className="h-5 w-3/4 rounded-md bg-[#e7ddcc]" /><div className="h-5 w-full rounded-md bg-[#e7ddcc]" /><div className="h-5 w-2/3 rounded-md bg-[#e7ddcc]" /></div>
              <div className="space-y-4 border-y border-[#ded3c0] py-6"><div className="h-4 w-full rounded-md bg-[#e7ddcc]" /><div className="h-4 w-4/5 rounded-md bg-[#e7ddcc]" /><div className="h-5 w-48 rounded-md bg-[#ded3c0]" /></div>
            </div>
          </div>
        </div>
      ) : null : error ? <ErrorState message={error} onRetry={() => void load()} /> : dream ? (
        <article className="relative mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-[#dfd2bd] bg-[#faf4e8] px-5 py-7 shadow-[0_22px_60px_rgba(91,72,47,0.10),0_2px_8px_rgba(91,72,47,0.05)] sm:mt-12 sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={paperNoise} aria-hidden="true" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(213,190,145,0.24)_0%,rgba(240,224,191,0.09)_48%,transparent_72%)] [animation-duration:8s] motion-reduce:animate-none" aria-hidden="true" />

          <header className="relative border-b border-[#ded3c0] pb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <ImaginationLabel />
              <div className="flex items-center gap-3">
                <MoonStar className="h-5 w-5 text-[#a88b60]" strokeWidth={1.2} aria-hidden="true" />
                <time dateTime={dream.local_date || dream.generated_at || dream.created_at} className="rounded-full border border-[#cdbca4] bg-[#fffaf0]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#78684f] shadow-sm">{formatDate(dream.local_date || dream.generated_at || dream.created_at, false, locale)}</time>
              </div>
            </div>
            <h1 className="mt-7 max-w-[20ch] break-words font-serif text-4xl leading-tight tracking-[-0.035em] text-[#302b25] [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">{dream.title || copy.untitled}</h1>
            {dream.emotional_theme && <p className="mt-5 text-sm font-medium capitalize text-[#98543f]">{copy.about} {dream.emotional_theme.replaceAll("_", " ")}</p>}
          </header>

          <div className="relative max-w-[65ch] py-9 sm:py-12">
            {dream.content.split(/\n+/).filter(Boolean).map((paragraph, index) => (
              <p key={index} className="mb-6 font-serif text-lg leading-8 text-[#413a31] [overflow-wrap:anywhere] last:mb-0 sm:text-xl sm:leading-9">{paragraph}</p>
            ))}
          </div>

          <aside className="relative max-w-[65ch] border-y border-[#ded3c0] py-6">
            <p className="text-sm leading-7 text-[#6e6254]">{copy.disclaimer}</p>
            {sourceCount > 0 ? (
              <details className="group mt-5 border-t border-[#e4dac9] pt-4">
                <summary className={`-mx-2 flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-2 text-sm font-semibold text-[#5f5548] transition-colors duration-200 hover:bg-[#f1e8d9] hover:text-[#7d4938] ${focusRing}`}>
                  {copy.threads}
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <div className="pt-2 text-sm leading-7 text-[#6e6254]">
                  <p>{sourceDescription}</p>
                  <Link href="/memories" className={`mt-3 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4 transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${focusRing}`}>{copy.review}</Link>
                </div>
              </details>
            ) : (
              <div className="mt-5 flex items-start gap-3 border-t border-[#e4dac9] pt-5">
                <Feather className="mt-1 h-4 w-4 shrink-0 text-[#967054]" aria-hidden="true" />
                <div><p className="text-sm font-semibold text-[#5f5548]">{copy.sourceZeroTitle}</p><p className="mt-1 text-sm leading-7 text-[#6e6254]">{copy.sourceZero}</p></div>
              </div>
            )}
          </aside>

          <div className="relative flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/settings" className={`inline-flex min-h-11 w-fit items-center rounded-lg px-2 text-sm font-semibold text-[#6e685f] underline decoration-[#cfc5b7] underline-offset-4 transition-[transform,color] duration-200 ease-out hover:-translate-y-px hover:text-[#923f30] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${focusRing}`}>{copy.settings}</Link>
            <button type="button" onClick={() => setConfirming(true)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-[#9e4837] transition-[transform,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[#f3e3d8] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none sm:justify-start ${focusRing}`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />{copy.delete}
            </button>
          </div>
        </article>
      ) : null}

      {confirming && dream && (
        <ConfirmDialog
          title={copy.confirmTitle}
          description={copy.confirmDescription(dream.title || copy.untitled)}
          confirmLabel={copy.confirmLabel}
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void removeDream()}
        />
      )}
    </>
  );
}
