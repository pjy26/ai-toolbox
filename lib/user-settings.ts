// Memory remains enabled for existing accounts until the Phase 2 settings table
// is installed. Once a row exists, the user's choice applies to every chat path.
export async function isMemoryEnabled(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("memory_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[settings] memory preference unavailable; using the compatible default");
    return true;
  }
  return data?.memory_enabled ?? true;
}
