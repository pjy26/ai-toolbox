"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { BookOpen, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ConfirmDialog, ErrorState, formatDate, Memory, PageLoader } from "@/components/amara-ui";

export default function MemoriesPage() {
  const { session } = useSessionContext();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ memories: Memory[] }>("/api/memories");
      setMemories(Array.isArray(result.memories) ? result.memories : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  function beginEdit(memory: Memory) {
    setActionError("");
    setEditingId(memory.id);
    setDraft(memory.summary);
  }

  async function saveMemory(id: string) {
    const summary = draft.trim();
    if (!summary || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await apiRequest(`/api/memories/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      setMemories((current) => current.map((memory) => memory.id === id ? { ...memory, summary, updated_at: new Date().toISOString() } : memory));
      setEditingId(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The memory couldn’t be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMemory() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setActionError("");
    try {
      await apiRequest(`/api/memories/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      setMemories((current) => current.filter((memory) => memory.id !== deleting.id));
      setDeleting(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The memory couldn’t be deleted.");
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">Your memory, your say</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">What Amara remembers</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">
          These are saved details from your conversations. Correct anything that no longer feels true, or remove it completely.
        </p>
      </header>

      {actionError && (
        <div className="mt-6 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{actionError}</div>
      )}

      {loading ? <PageLoader label="Opening your memories…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : memories.length === 0 ? (
        <div className="py-16 sm:py-20">
          <BookOpen className="h-7 w-7 text-[#a98a78]" strokeWidth={1.4} aria-hidden="true" />
          <h2 className="mt-5 font-serif text-3xl">Nothing saved here yet.</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">That’s okay. Meaningful details from your conversations will appear here for you to review—not as a hidden profile.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="py-4 text-xs text-[#817a70]">{memories.length} {memories.length === 1 ? "memory" : "memories"}</p>
          <ul className="border-t border-[#ded7cc]">
            {memories.map((memory) => {
              const isEditing = editingId === memory.id;
              return (
                <li key={memory.id} className="border-b border-[#ded7cc] py-6 sm:py-7">
                  {isEditing ? (
                    <div>
                      <label htmlFor={`memory-${memory.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#817a70]">Edit this memory</label>
                      <textarea
                        id={`memory-${memory.id}`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        disabled={saving}
                        rows={4}
                        autoFocus
                        className="mt-3 w-full resize-y border border-[#bfb3a4] bg-[#fffdf8] p-4 text-base leading-7 text-[#37332d] outline-none focus:border-[#a34f3d] focus:ring-2 focus:ring-[#a34f3d]/15 disabled:opacity-60"
                      />
                      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#d8cfc2] px-4 text-sm font-medium hover:bg-[#f1ece4] disabled:opacity-50"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveMemory(memory.id)}
                          disabled={saving || !draft.trim()}
                          className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#9e4837] px-5 text-sm font-semibold text-white hover:bg-[#833a2c] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          {saving ? "Saving…" : "Save correction"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sm:flex sm:items-start sm:justify-between sm:gap-8">
                      <div className="max-w-3xl">
                        <p className="text-base leading-7 text-[#37332d]">{memory.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#817a70]">
                          <span>{memory.source_session_id ? "From a conversation" : "Saved memory"}</span>
                          <span>Updated {formatDate(memory.updated_at || memory.created_at, true)}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2 sm:mt-0 sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => beginEdit(memory)}
                          className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] px-4 text-sm font-medium text-[#5f5951] hover:bg-[#f1ece4]"
                          aria-label={`Edit memory: ${memory.summary}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(memory)}
                          className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4]"
                          aria-label={`Delete memory: ${memory.summary}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this memory?"
          description={`“${deleting.summary}” will be removed from Amara’s saved memories. This can’t be undone.`}
          confirmLabel="Delete memory"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void removeMemory()}
        />
      )}
    </AppShell>
  );
}
