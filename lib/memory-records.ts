import { dedupeMemoryEntries, isExpiredTransientMemory } from "@/lib/memory-reliability";

export const PROFILE_MEMORY_PREFIX = "profile_";

export type ConsoleMemoryRecord = {
  id: string;
  companion_id: string;
  summary: string;
  importance: number;
  source_session_id: string | null;
  created_at: string;
  updated_at: string;
  record_type: "summary" | "profile";
};

type ProfilePath = Array<string | number>;

function profileMemoryId(companionId: string, path: ProfilePath) {
  return `${PROFILE_MEMORY_PREFIX}${companionId}_${Buffer.from(JSON.stringify(path), "utf8").toString("base64url")}`;
}

export function parseProfileMemoryId(id: string): { companionId: string; path: ProfilePath } | null {
  if (!id.startsWith(PROFILE_MEMORY_PREFIX)) return null;
  const rest = id.slice(PROFILE_MEMORY_PREFIX.length);
  const separator = rest.indexOf("_");
  if (separator < 1) return null;
  const companionId = rest.slice(0, separator);
  try {
    const path = JSON.parse(Buffer.from(rest.slice(separator + 1), "base64url").toString("utf8"));
    if (!Array.isArray(path) || !path.length || !path.every((part) => typeof part === "string" || typeof part === "number")) return null;
    return { companionId, path };
  } catch {
    return null;
  }
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join("、");
  return "";
}

function flattenProfile(companionId: string, profile: Record<string, unknown>, timestamp: string): ConsoleMemoryRecord[] {
  const records: ConsoleMemoryRecord[] = [];
  const add = (path: ProfilePath, summary: string) => {
    const clean = summary.trim();
    if (!clean) return;
    records.push({
      id: profileMemoryId(companionId, path),
      companion_id: companionId,
      summary: clean.slice(0, 4000),
      importance: 3,
      source_session_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      record_type: "profile",
    });
  };

  for (const section of ["basic_info", "preferences"]) {
    const value = profile[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [key, item] of Object.entries(value)) {
      const detail = displayValue(item);
      if (detail) add([section, key], `${key}: ${detail}`);
    }
  }
  for (const section of ["key_facts", "ongoing_matters"]) {
    const value = profile[section];
    if (!Array.isArray(value)) continue;
    value.forEach((item, index) => add([section, index], displayValue(item)));
  }
  add(["personality_notes"], displayValue(profile.personality_notes));
  return records;
}

/** The console reads the same two factual sources used by chat: profile + summaries. */
export async function listMemoryRecords(
  supabase: any,
  companionIds: string[],
  now = new Date(),
): Promise<ConsoleMemoryRecord[]> {
  if (!companionIds.length) return [];
  const [summaryResult, profileResult] = await Promise.all([
    supabase
      .from("memory_summaries")
      .select("id, companion_id, summary, importance, source_session_id, created_at, updated_at")
      .in("companion_id", companionIds)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("user_profiles")
      .select("companion_id, profile, updated_at")
      .in("companion_id", companionIds),
  ]);
  if (summaryResult.error) throw new Error(summaryResult.error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);

  const summaries = ((summaryResult.data || []) as any[]).map((memory) => ({
    ...memory,
    record_type: "summary" as const,
  }));
  const visibleSummaries = dedupeMemoryEntries(
    summaries,
    (memory) => memory.summary,
    (memory) => isExpiredTransientMemory(memory.summary, memory.updated_at || memory.created_at, now),
  );
  const profileRecords = ((profileResult.data || []) as any[]).flatMap((row) => flattenProfile(
    row.companion_id,
    row.profile && typeof row.profile === "object" ? row.profile : {},
    row.updated_at || row.created_at || now.toISOString(),
  ));

  return dedupeMemoryEntries(
    [...profileRecords, ...visibleSummaries],
    (memory) => memory.summary,
  ).sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at));
}

/** Delete one flattened profile item without exposing general profile editing. */
export async function deleteProfileMemory(
  supabase: any,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = parseProfileMemoryId(id);
  if (!parsed) return { ok: false, status: 400, error: "档案记忆标识无效" };
  const { data: companion, error: companionError } = await supabase
    .from("companions")
    .select("id")
    .eq("id", parsed.companionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (companionError) return { ok: false, status: 500, error: "校验记忆归属失败" };
  if (!companion) return { ok: false, status: 404, error: "记忆不存在" };

  const { data: row, error: readError } = await supabase
    .from("user_profiles")
    .select("profile")
    .eq("companion_id", parsed.companionId)
    .maybeSingle();
  if (readError) return { ok: false, status: 500, error: "读取档案记忆失败" };
  if (!row?.profile || typeof row.profile !== "object") return { ok: false, status: 404, error: "记忆不存在" };

  const profile = JSON.parse(JSON.stringify(row.profile));
  let cursor: any = profile;
  for (let index = 0; index < parsed.path.length - 1; index += 1) {
    cursor = cursor?.[parsed.path[index]];
    if (cursor === undefined || cursor === null) return { ok: false, status: 404, error: "记忆不存在" };
  }
  const leaf = parsed.path[parsed.path.length - 1];
  if (Array.isArray(cursor) && typeof leaf === "number") {
    if (leaf < 0 || leaf >= cursor.length) return { ok: false, status: 404, error: "记忆不存在" };
    cursor.splice(leaf, 1);
  } else if (cursor && typeof cursor === "object" && typeof leaf === "string") {
    if (!(leaf in cursor)) return { ok: false, status: 404, error: "记忆不存在" };
    delete cursor[leaf];
  } else {
    return { ok: false, status: 400, error: "档案记忆路径无效" };
  }

  const { error: writeError } = await supabase
    .from("user_profiles")
    .update({ profile })
    .eq("companion_id", parsed.companionId);
  if (writeError) return { ok: false, status: 500, error: "删除档案记忆失败" };
  return { ok: true };
}
