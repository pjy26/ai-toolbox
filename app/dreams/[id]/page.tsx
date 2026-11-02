"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ConfirmDialog, Dream, ErrorState, formatDate, ImaginationLabel, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";

const detailCopy = {
  en: {
    allDreams: "All Dreams",
    opening: "Opening this Dream…",
    untitled: "An untitled Dream",
    about: "A Dream about",
    disclaimer: "This is a creative reflection, not something that happened. Nothing in this Dream becomes a factual memory about you.",
    threads: "Real threads behind the imagination",
    sourceOne: "This Dream was generated with reference to 1 real conversation thread or saved moment.",
    sourceMany: "This Dream was generated with references to {count} real conversation threads and saved moments.",
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
    sourceOne: "这场梦参考了 1 条真实对话或已保存的片段。",
    sourceMany: "这场梦参考了 {count} 条真实对话或已保存的片段。",
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

export default function DreamDetailPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = detailCopy[locale];
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);
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
      const result = await apiRequest<{ dream: Dream }>(`/api/dreams/${encodeURIComponent(id)}`);
      setDream(result.dream);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, id, session]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <AppShell>
      <Link href="/dreams" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#6e685f] hover:text-[#923f30]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{copy.allDreams}
      </Link>

      {deleteError && <div className="mt-5 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{deleteError}</div>}

      {loading ? <PageLoader label={copy.opening} /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : dream ? (
        <article className="mx-auto max-w-3xl pt-8 sm:pt-12">
          <header className="border-b border-[#ded7cc] pb-8">
            <ImaginationLabel />
            <p className="mt-6 text-xs font-medium text-[#817a70]">{formatDate(dream.local_date || dream.generated_at || dream.created_at, false, locale)}</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-6xl">{dream.title || copy.untitled}</h1>
            {dream.emotional_theme && <p className="mt-5 text-sm capitalize text-[#a34f3d]">{copy.about} {dream.emotional_theme.replaceAll("_", " ")}</p>}
          </header>

          <div className="py-9 sm:py-12">
            {dream.content.split(/\n+/).filter(Boolean).map((paragraph, index) => (
              <p key={index} className="mb-6 font-serif text-xl leading-9 text-[#413d36] last:mb-0 sm:text-[1.35rem] sm:leading-10">{paragraph}</p>
            ))}
          </div>

          <aside className="border-y border-[#ded7cc] py-6">
            <p className="text-sm leading-7 text-[#6e685f]">{copy.disclaimer}</p>
            {sourceCount > 0 && (
              <details className="group mt-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#5f5951]">
                  {copy.threads}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="pt-2 text-sm leading-7 text-[#6e685f]">
                  <p>{sourceDescription}</p>
                  <Link href="/memories" className="mt-2 inline-block font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4">{copy.review}</Link>
                </div>
              </details>
            )}
          </aside>

          <div className="flex flex-col gap-2 py-7 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/settings" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#6e685f] underline decoration-[#cfc5b7] underline-offset-4">{copy.settings}</Link>
            <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4] sm:justify-start">
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
    </AppShell>
  );
}
