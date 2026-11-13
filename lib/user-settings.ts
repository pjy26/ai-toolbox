// A missing row means the default preference. A failed read is not consent.
export async function isMemoryEnabled(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("memory_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[settings] memory preference unavailable; skipping memory processing");
      return false;
    }
    return data?.memory_enabled ?? true;
  } catch {
    console.warn("[settings] memory preference unavailable; skipping memory processing");
    return false;
  }
}
