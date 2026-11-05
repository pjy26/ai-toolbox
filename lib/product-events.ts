export const PRODUCT_EVENT_NAMES = [
  "companion_created",
  "companion_switched",
  "chat_opened",
  "chat_reply_completed",
  "chat_reply_failed",
  "memory_extract_completed",
  "memory_extract_failed",
  "paywall_viewed",
  "checkout_started",
  "checkout_failed",
  "quota_exhausted",
] as const;

export const CLIENT_PRODUCT_EVENT_NAMES = [
  "companion_switched",
  "chat_opened",
  "paywall_viewed",
  "checkout_started",
  "checkout_failed",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ClientProductEventName = (typeof CLIENT_PRODUCT_EVENT_NAMES)[number];
export type ProductEventDetails = {
  reason?: string;
  planId?: string;
  status?: string | number;
  source?: string;
  freeMessagesUsed?: number;
  profile?: string;
};

const EVENT_SET = new Set<string>(PRODUCT_EVENT_NAMES);
const CLIENT_EVENT_SET = new Set<string>(CLIENT_PRODUCT_EVENT_NAMES);

function cleanMetadata(details?: ProductEventDetails) {
  const metadata: Record<string, string | number> = {};
  if (!details) return metadata;
  for (const key of ["reason", "planId", "source", "profile"] as const) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) metadata[key] = value.trim().slice(0, 80);
  }
  if (typeof details.status === "string" && details.status.trim()) metadata.status = details.status.trim().slice(0, 80);
  if (typeof details.status === "number" && Number.isFinite(details.status)) metadata.status = details.status;
  if (typeof details.freeMessagesUsed === "number" && Number.isFinite(details.freeMessagesUsed)) {
    metadata.freeMessagesUsed = Math.max(0, Math.floor(details.freeMessagesUsed));
  }
  return metadata;
}

export function isProductEventName(value: unknown): value is ProductEventName {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function isClientProductEventName(value: unknown): value is ClientProductEventName {
  return typeof value === "string" && CLIENT_EVENT_SET.has(value);
}

/** Server-side diagnostic write. It must never receive message or memory text. */
export async function recordProductEvent(
  supabase: any,
  userId: string,
  eventName: ProductEventName,
  options: { companionId?: string | null; locale?: string; details?: ProductEventDetails } = {},
): Promise<boolean> {
  try {
    // Browser-role inserts are limited by RLS to client telemetry. Completion,
    // failure, and quota facts must come from the privileged server client.
    const writer = isClientProductEventName(eventName)
      ? supabase
      : (await import("./supabase")).createServerAdminClient();
    const { error } = await writer.from("product_events").insert({
      user_id: userId,
      companion_id: options.companionId || null,
      event_name: eventName,
      locale: options.locale === "zh" ? "zh" : options.locale === "en" ? "en" : null,
      metadata: cleanMetadata(options.details),
    });
    if (error) console.warn("[product-events] unavailable", eventName, error.message);
    return !error;
  } catch {
    return false;
  }
}

/** Browser events are best-effort and never block the user experience. */
export async function trackProductEvent(
  eventName: ClientProductEventName,
  options: { companionId?: string | null; locale?: string; details?: ProductEventDetails } = {},
): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        companionId: options.companionId || null,
        locale: options.locale,
        details: cleanMetadata(options.details),
      }),
      keepalive: true,
    });
  } catch { /* Diagnostics must never become a user-facing failure. */ }
}
