export type CompanionGender = "female" | "male";

export function normalizeCompanionGender(value: unknown, fallback: CompanionGender = "female"): CompanionGender {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["male", "man", "男"].includes(normalized)) return "male";
  if (["female", "woman", "女"].includes(normalized)) return "female";
  return fallback;
}

export function chooseActiveCompanionId<T extends { id: string }>(
  companions: T[],
  requestedId?: string | null,
): string | null {
  if (requestedId && companions.some((companion) => companion.id === requestedId)) return requestedId;
  return companions[0]?.id || null;
}

/** Resolve one active profile; never merge both profiles into console queries. */
export async function getActiveCompanionId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const [settingsResult, companionsResult] = await Promise.all([
    supabase.from("user_settings").select("active_companion_id").eq("user_id", userId).maybeSingle(),
    supabase.from("companions").select("id").eq("user_id", userId).order("updated_at", { ascending: false }),
  ]);

  if (settingsResult.error) {
    // Older databases can still use their original single profile until the
    // additive migration is installed. No chat content is logged here.
    console.warn("[companions] active profile preference unavailable; using compatible default");
  }
  if (companionsResult.error) throw new Error(companionsResult.error.message);
  return chooseActiveCompanionId(companionsResult.data || [], settingsResult.data?.active_companion_id);
}
