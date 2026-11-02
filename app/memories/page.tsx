"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { BookOpen, Check, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ConfirmDialog, ErrorState, formatDate, Memory, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

export default function MemoriesPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].memories;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ memories: Memory[] }>("/api/memories");
      const items = Array.isArray(result.memories) ? result.memories : [];
      setMemories(items);
      setSelected((current) => new Set(Array.from(current).filter((id) => items.some((memory) => memory.id === id))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function removeMemories(ids: string[]) {
    if (!ids.length || deleteBusy) return;
    setDeleteBusy(true);
    setActionError("");
    const results = await Promise.allSettled(ids.map((id) => apiRequest(`/api/memories/${encodeURIComponent(id)}`, { method: "DELETE" })));
    const removed = new Set(ids.filter((_, index) => results[index].status === "fulfilled"));
    setMemories((current) => current.filter((memory) => !removed.has(memory.id)));
    setSelected((current) => new Set(Array.from(current).filter((id) => !removed.has(id))));
    if (removed.size !== ids.length) setActionError(copy.failed);
    setDeleting(null);
    setBulkDeleting(false);
    setDeleteBusy(false);
  }

  const allSelected = memories.length > 0 && selected.size === memories.length;

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {actionError && <div className="mt-6 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{actionError}</div>}

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : memories.length === 0 ? (
        <div className="py-16 sm:py-20"><BookOpen className="h-7 w-7 text-[#a98a78]" strokeWidth={1.4} /><h2 className="mt-5 font-serif text-3xl">{copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{copy.emptyBody}</p></div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded7cc] py-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#625d55]">
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(memories.map((memory) => memory.id)))} className="h-4 w-4 accent-[#9e4837]" />
              {copy.select} · {memories.length} {copy.count}
            </label>
            <button type="button" disabled={!selected.size} onClick={() => setBulkDeleting(true)} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] px-4 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4] disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="h-4 w-4" />{copy.deleteSelected}{selected.size > 0 && ` (${selected.size})`}
            </button>
          </div>
          <ul className="divide-y divide-[#e4ddd3]">
            {memories.map((memory) => (
              <li key={memory.id} className={`py-5 transition-colors sm:px-4 ${selected.has(memory.id) ? "bg-[#f3ebe2]" : ""}`}>
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => toggle(memory.id)} aria-label={`${copy.select}: ${memory.summary}`} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border ${selected.has(memory.id) ? "border-[#9e4837] bg-[#9e4837] text-white" : "border-[#cfc5b7] bg-[#fffdf8]"}`}>
                    {selected.has(memory.id) && <Check className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-7 text-[#37332d]">{memory.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#817a70]"><span>{memory.source_session_id ? copy.fromChat : copy.saved}</span><span>{copy.updated} {formatDate(memory.updated_at || memory.created_at, false, locale)}</span></div>
                  </div>
                  <button type="button" onClick={() => setDeleting(memory)} className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4]" aria-label={`${copy.delete}: ${memory.summary}`}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">{copy.delete}</span></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deleting && <ConfirmDialog title={copy.deleteTitle} description={`“${deleting.summary}”\n${copy.deleteBody}`} confirmLabel={copy.deleteConfirm} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={() => void removeMemories([deleting.id])} />}
      {bulkDeleting && <ConfirmDialog title={copy.bulkTitle} description={`${selected.size} ${copy.selected}。${copy.bulkBody}`} confirmLabel={copy.bulkConfirm} busy={deleteBusy} onCancel={() => setBulkDeleting(false)} onConfirm={() => void removeMemories(Array.from(selected))} />}
    </AppShell>
  );
}
