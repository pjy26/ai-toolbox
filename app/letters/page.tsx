"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ChevronDown, ChevronUp, Loader2, Mail, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ConfirmDialog, ErrorState, formatDate, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";
import {
  countUnreadLetters,
  dispatchLetterUnreadCount,
  isUnreadLetter,
  type LetterDetail,
  type LetterSummary,
} from "@/lib/letter";

export default function LettersPage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].letters;
  const [letters, setLetters] = useState<LetterSummary[]>([]);
  const lettersRef = useRef<LetterSummary[]>([]);
  const [details, setDetails] = useState<Record<string, LetterDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingLetterId, setLoadingLetterId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LetterSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ letters: LetterSummary[]; unavailable?: boolean }>("/api/letters");
      const items = Array.isArray(result.letters) ? result.letters : [];
      lettersRef.current = items;
      setLetters(items);
      setUnavailable(Boolean(result.unavailable));
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [session, copy.loadError]);

  useEffect(() => { void load(); }, [load]);

  function commitLetters(next: LetterSummary[]) {
    lettersRef.current = next;
    setLetters(next);
    dispatchLetterUnreadCount(countUnreadLetters(next));
  }

  async function markRead(letter: LetterDetail) {
    if (letter.read_at) return;
    setActionError("");
    try {
      const result = await apiRequest<{ letter: LetterDetail }>(`/api/letters/${encodeURIComponent(letter.id)}`, { method: "PATCH" });
      setDetails((current) => ({ ...current, [letter.id]: result.letter }));
      commitLetters(lettersRef.current.map((item) => item.id === letter.id ? { ...item, read_at: result.letter.read_at } : item));
    } catch {
      setActionError(copy.readFailed);
    }
  }

  async function openLetter(summary: LetterSummary, retry = false) {
    if (expandedId === summary.id && !retry) {
      setExpandedId(null);
      setDetailError("");
      return;
    }
    setExpandedId(summary.id);
    setDetailError("");
    setActionError("");
    const cached = details[summary.id];
    if (cached && !retry) {
      if (!cached.read_at) await markRead(cached);
      return;
    }

    setLoadingLetterId(summary.id);
    try {
      const result = await apiRequest<{ letter: LetterDetail }>(`/api/letters/${encodeURIComponent(summary.id)}`);
      setDetails((current) => ({ ...current, [summary.id]: result.letter }));
      // Content opens first; only a successful subsequent PATCH clears this letter's unread state.
      if (!result.letter.read_at) await markRead(result.letter);
    } catch {
      setDetailError(copy.letterError);
    } finally {
      setLoadingLetterId(null);
    }
  }

  async function deleteLetter() {
    if (!deleting || deleteBusy) return;
    const id = deleting.id;
    setDeleteBusy(true);
    setActionError("");
    try {
      await apiRequest(`/api/letters/${encodeURIComponent(id)}`, { method: "DELETE" });
      commitLetters(lettersRef.current.filter((letter) => letter.id !== id));
      setDetails((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (expandedId === id) setExpandedId(null);
      setDeleting(null);
    } catch {
      setActionError(copy.deleteFailed);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {actionError && <div className="mt-6 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{actionError}</div>}

      {loading ? <PageLoader label={copy.loading} /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : letters.length === 0 ? (
        <section className="mx-auto mt-12 max-w-2xl border border-[#ddcfc0] bg-[#fffaf1] px-7 py-12 text-center shadow-[10px_10px_0_#ece1d4] sm:px-12 sm:py-16">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0e1d4] text-[#a34f3d]">
            <Mail className="h-7 w-7" strokeWidth={1.35} />
            <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-[#b59267]" strokeWidth={1.3} />
          </div>
          <h2 className="mt-7 font-serif text-3xl leading-tight text-[#413b34]">{unavailable ? copy.unavailableTitle : copy.emptyTitle}</h2>
          {unavailable && <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#6e685f]">{copy.unavailableBody}</p>}
        </section>
      ) : (
        <section className="mx-auto mt-8 max-w-3xl" aria-label={copy.title}>
          <ul className="space-y-5">
            {letters.map((letter) => {
              const expanded = expandedId === letter.id;
              const detail = details[letter.id];
              const unread = isUnreadLetter(letter);
              return (
                <li key={letter.id} className="border border-[#ddcfc0] bg-[#fffaf1] shadow-[5px_5px_0_#eee4d8]">
                  <button
                    type="button"
                    onClick={() => void openLetter(letter)}
                    aria-expanded={expanded}
                    aria-controls={`letter-${letter.id}`}
                    className="flex min-h-24 w-full items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-[#fdf5e9] sm:px-7"
                  >
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0e1d4] text-[#a34f3d]"><Mail className="h-4 w-4" strokeWidth={1.5} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {unread && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a34f3d]"><span className="h-2 w-2 rounded-full bg-[#b64f43]" aria-hidden="true" />{copy.unread}</span>}
                        <span className="text-xs text-[#817a70]">{formatDate(letter.generated_at || letter.created_at, false, locale)}</span>
                      </span>
                      <span className="mt-2 block font-serif text-2xl leading-tight text-[#413b34]">{letter.title}</span>
                      <span className="mt-2 block text-xs font-medium text-[#817a70]">{expanded ? copy.close : copy.open}</span>
                    </span>
                    {expanded ? <ChevronUp className="mt-2 h-5 w-5 shrink-0 text-[#817a70]" /> : <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-[#817a70]" />}
                  </button>

                  {expanded && (
                    <div id={`letter-${letter.id}`} className="border-t border-[#e4d6c8] px-6 py-7 sm:px-10 sm:py-9">
                      {loadingLetterId === letter.id ? (
                        <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-[#756f66]" role="status"><Loader2 className="h-4 w-4 animate-spin" />{copy.letterLoading}</div>
                      ) : detailError ? (
                        <div className="text-sm text-[#813d30]" role="alert"><p>{detailError}</p><button type="button" onClick={() => void openLetter(letter, true)} className="mt-4 min-h-11 border border-[#b75c47] px-4 font-medium">{copy.retry}</button></div>
                      ) : detail ? (
                        <article>
                          <div className="whitespace-pre-wrap font-serif text-[17px] leading-9 text-[#413b34]">{detail.content}</div>
                          <div className="mt-8 flex justify-end border-t border-[#e4d6c8] pt-4">
                            <button type="button" onClick={() => setDeleting(letter)} className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-[#9e4837] hover:bg-[#f6eae4]"><Trash2 className="h-4 w-4" />{copy.delete}</button>
                          </div>
                        </article>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {deleting && <ConfirmDialog title={copy.deleteTitle} description={`“${deleting.title}”\n${copy.deleteBody}`} confirmLabel={copy.deleteConfirm} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={() => void deleteLetter()} />}
    </AppShell>
  );
}
