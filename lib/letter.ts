export const LETTER_LIST_SELECT = "id, companion_id, title, locale, relationship_stage, milestone_key, read_at, generated_at, created_at";
export const LETTER_DETAIL_SELECT = `${LETTER_LIST_SELECT}, content`;

export type LetterStatus = "draft" | "published" | "deleted";

export type LetterSummary = {
  id: string;
  companion_id: string;
  title: string;
  locale: string;
  relationship_stage: number;
  milestone_key: string;
  read_at: string | null;
  generated_at: string | null;
  created_at: string;
};

export type LetterDetail = LetterSummary & {
  content: string;
};

export function isUnreadLetter(letter: { status?: LetterStatus; read_at: string | null }): boolean {
  return (letter.status ?? "published") === "published" && letter.read_at === null;
}

export function countUnreadLetters(letters: Array<{ status?: LetterStatus; read_at: string | null }>): number {
  return letters.filter(isUnreadLetter).length;
}

/** Mirrors the read-side RLS boundary without exposing draft existence. */
export function canAccessLetter(
  userId: string | null | undefined,
  letter: { user_id: string; status: LetterStatus },
): boolean {
  return Boolean(userId) && letter.user_id === userId && letter.status !== "draft";
}

export function letterUnreadCountFromEvent(detail: unknown): number | null {
  if (typeof detail === "boolean") return detail ? 1 : 0;
  if (typeof detail === "number" && Number.isFinite(detail)) return Math.max(0, Math.floor(detail));
  if (detail && typeof detail === "object" && "unreadCount" in detail) {
    const count = (detail as { unreadCount?: unknown }).unreadCount;
    if (typeof count === "number" && Number.isFinite(count)) return Math.max(0, Math.floor(count));
  }
  return null;
}

/** Keeps the original boolean CustomEvent compatible while allowing exact counts. */
export function dispatchLetterUnreadCount(unreadCount: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("amara:letters-unread", {
    detail: { unreadCount: Math.max(0, Math.floor(unreadCount)) },
  }));
}
