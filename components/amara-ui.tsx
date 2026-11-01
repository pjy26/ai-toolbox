"use client";

import { AlertCircle, Loader2, MoonStar, X } from "lucide-react";
import { useEffect, useRef } from "react";

export type Memory = {
  id: string;
  summary: string;
  importance: number;
  source_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Dream = {
  id: string;
  title: string | null;
  content: string;
  emotional_theme: string | null;
  local_date: string | null;
  generated_at: string | null;
  created_at: string;
  next_day_hook?: string | null;
  source_message_ids?: string[] | null;
  source_memory_ids?: string[] | null;
  source_event_ids?: string[] | null;
};

export type Companion = {
  id: string;
  relationship_type: "friend" | "lover" | string;
  companion_name: string | null;
  user_nickname: string | null;
  relationship_stage: string | number | null;
  live_state: unknown;
  last_active_at: string | null;
};

export type RelationshipEvent = {
  id: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  description?: string | null;
  event_type?: string | null;
  occurred_at?: string | null;
  created_at: string;
};

export function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "Date unavailable";
  // A Dream's local_date is a calendar date, not a UTC instant. Noon local time
  // avoids shifting it to the previous day when formatting in western time zones.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function getLiveState(value: unknown): { text: string | null; updatedAt: string | null; lastTopic: string | null } {
  if (typeof value === "string") return { text: value.trim() || null, updatedAt: null, lastTopic: null };
  if (!value || typeof value !== "object") return { text: null, updatedAt: null, lastTopic: null };
  const state = value as Record<string, unknown>;
  const candidate = state.current_activity ?? state.text ?? state.description ?? state.activity ?? state.status;
  const updated = state.updated_at ?? state.updatedAt;
  const topic = state.last_topic;
  return {
    text: typeof candidate === "string" && candidate.trim() ? candidate : null,
    updatedAt: typeof updated === "string" ? updated : null,
    lastTopic: typeof topic === "string" && topic.trim() ? topic : null,
  };
}

export function isFreshState(updatedAt: string | null, lastActiveAt: string | null) {
  const timestamp = updatedAt || lastActiveAt;
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) && Date.now() - time >= 0 && Date.now() - time < 6 * 60 * 60 * 1000;
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    if (response.status === 404) throw new Error("This item could not be found. It may have been removed.");
    // Keep the English-first UI consistent even if an API returns a localized
    // internal error string. The response is still checked; no fallback data is shown.
    throw new Error("The request couldn’t be completed. Please try again.");
  }
  return data as T;
}

export function PageLoader({ label = "Gathering your moments…" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-sm text-[#756f66]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="my-8 border-l-2 border-[#b75c47] bg-[#f6eae4] px-5 py-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#9e4837]" aria-hidden="true" />
        <div>
          <p className="font-medium text-[#65372d]">We couldn’t load this just now.</p>
          <p className="mt-1 text-sm leading-6 text-[#805b50]">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 min-h-11 border border-[#b75c47] px-4 text-sm font-medium text-[#813d30] transition-colors hover:bg-[#eedbd2]"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImaginationLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a34f3d]">
      <MoonStar className="h-3.5 w-3.5" aria-hidden="true" />
      Imagination, not fact
    </span>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#211f1b]/45 p-4 sm:items-center" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md border border-[#d9d0c4] bg-[#fffdf8] p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-title" className="font-serif text-2xl text-[#282621]">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-11 w-11 items-center justify-center text-[#756f66] hover:text-[#282621] disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p id="confirm-description" className="mt-2 text-sm leading-6 text-[#6e685f]">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 border border-[#d9d0c4] px-5 text-sm font-medium text-[#49453e] hover:bg-[#f3eee6] disabled:opacity-50"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex min-h-11 items-center justify-center gap-2 bg-[#9e4837] px-5 text-sm font-medium text-white hover:bg-[#843a2c] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
