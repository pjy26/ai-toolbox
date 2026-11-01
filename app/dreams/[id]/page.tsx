"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ConfirmDialog, Dream, ErrorState, formatDate, ImaginationLabel, PageLoader } from "@/components/amara-ui";

export default function DreamDetailPage() {
  const { session } = useSessionContext();
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id, session]);

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
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "The Dream couldn’t be deleted.");
      setConfirming(false);
      setDeleting(false);
    }
  }

  const sourceCount = dream
    ? (dream.source_message_ids?.length || 0) + (dream.source_memory_ids?.length || 0) + (dream.source_event_ids?.length || 0)
    : 0;

  return (
    <AppShell>
      <Link href="/dreams" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#6e685f] hover:text-[#923f30]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />All Dreams
      </Link>

      {deleteError && <div className="mt-5 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{deleteError}</div>}

      {loading ? <PageLoader label="Opening this Dream…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : dream ? (
        <article className="mx-auto max-w-3xl pt-8 sm:pt-12">
          <header className="border-b border-[#ded7cc] pb-8">
            <ImaginationLabel />
            <p className="mt-6 text-xs font-medium text-[#817a70]">{formatDate(dream.local_date || dream.generated_at || dream.created_at)}</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-6xl">{dream.title || "An untitled Dream"}</h1>
            {dream.emotional_theme && <p className="mt-5 text-sm capitalize text-[#a34f3d]">A Dream about {dream.emotional_theme.replaceAll("_", " ")}</p>}
          </header>

          <div className="py-9 sm:py-12">
            {dream.content.split(/\n+/).filter(Boolean).map((paragraph, index) => (
              <p key={index} className="mb-6 font-serif text-xl leading-9 text-[#413d36] last:mb-0 sm:text-[1.35rem] sm:leading-10">{paragraph}</p>
            ))}
          </div>

          <aside className="border-y border-[#ded7cc] py-6">
            <p className="text-sm leading-7 text-[#6e685f]">
              This is a creative reflection, not something that happened. Nothing in this Dream becomes a factual memory about you.
            </p>
            {sourceCount > 0 && (
              <details className="group mt-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#5f5951]">
                  Real threads behind the imagination
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="pt-2 text-sm leading-7 text-[#6e685f]">
                  <p>This Dream was generated with references to {sourceCount} {sourceCount === 1 ? "real conversation thread or saved moment" : "real conversation threads and saved moments"}.</p>
                  <Link href="/memories" className="mt-2 inline-block font-semibold text-[#923f30] underline decoration-[#d5b6aa] underline-offset-4">Review saved memories</Link>
                </div>
              </details>
            )}
          </aside>

          <div className="flex flex-col gap-2 py-7 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/settings" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#6e685f] underline decoration-[#cfc5b7] underline-offset-4">Turn off future Dreams in Settings</Link>
            <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4] sm:justify-start">
              <Trash2 className="h-4 w-4" aria-hidden="true" />Delete this Dream
            </button>
          </div>
        </article>
      ) : null}

      {confirming && dream && (
        <ConfirmDialog
          title="Delete this Dream?"
          description={`“${dream.title || "An untitled Dream"}” will be removed from your Dream journal. This can’t be undone.`}
          confirmLabel="Delete Dream"
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void removeDream()}
        />
      )}
    </AppShell>
  );
}
