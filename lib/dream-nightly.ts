import { createServerAdminClient } from "@/lib/supabase";
import { activeMembershipTier } from "@/lib/admin-membership";
import { DREAM_PROMPT_VERSION, generateDream } from "@/lib/dream";
import { scanWaffoContent } from "@/lib/content-safety";
import {
  getLocalDate,
  getLocalDateRange,
  isLocalNightlyWindow,
  normalizeTimeZone,
} from "@/lib/timezone";

const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 15 * 60 * 1000;
const SCAN_LIMIT = 100;

type AdminClient = ReturnType<typeof createServerAdminClient>;

type CompanionRow = {
  id: string;
  user_id: string;
  relationship_type: string;
  companion_name: string | null;
  user_nickname: string | null;
  persona: string | null;
  relationship_stage: number | null;
};

type SettingsRow = {
  user_id: string;
  locale: string;
  timezone: string;
  dream_enabled: boolean;
  memory_enabled: boolean;
};

type NightlyJob = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  started_at: string | null;
};

type Candidate = {
  companion: CompanionRow;
  settings: SettingsRow;
  localDate: string;
};

export type NightlySummary = {
  scanned: number;
  due: number;
  succeeded: number;
  skipped: number;
  failed: number;
  already_processed: number;
};

function defaultSettings(userId: string): SettingsRow {
  return {
    user_id: userId,
    locale: "en",
    timezone: "UTC",
    dream_enabled: true,
    memory_enabled: true,
  };
}

async function finishJob(
  admin: AdminClient,
  jobId: string,
  status: "succeeded" | "failed" | "skipped",
  range: { start: Date; end: Date },
  error?: string,
) {
  const { error: updateError } = await admin
    .from("nightly_jobs")
    .update({
      status,
      range_start: range.start.toISOString(),
      range_end: range.end.toISOString(),
      last_error: error?.slice(0, 500) || null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (updateError) console.error("[nightly] failed to finish job", updateError.message);
}

async function claimJob(admin: AdminClient, candidate: Candidate): Promise<NightlyJob | null | "done"> {
  const { companion, localDate } = candidate;
  const { error: insertError } = await admin.from("nightly_jobs").upsert(
    {
      companion_id: companion.id,
      job_type: "all",
      local_date: localDate,
      status: "pending",
    },
    { onConflict: "companion_id,job_type,local_date", ignoreDuplicates: true },
  );
  if (insertError) throw new Error(`Could not create nightly job: ${insertError.message}`);

  const { data: job, error } = await admin
    .from("nightly_jobs")
    .select("id, status, attempts, started_at")
    .eq("companion_id", companion.id)
    .eq("job_type", "all")
    .eq("local_date", localDate)
    .single<NightlyJob>();
  if (error || !job) throw new Error(`Could not read nightly job: ${error?.message || "missing"}`);

  if (job.status === "succeeded" || job.status === "skipped") return "done";
  if (job.attempts >= MAX_ATTEMPTS) return "done";
  if (
    job.status === "running" &&
    job.started_at &&
    Date.now() - Date.parse(job.started_at) < STALE_RUNNING_MS
  ) {
    return "done";
  }

  // Compare-and-swap prevents two schedulers from running the same pending or
  // stale job concurrently. The daily Dream unique index is the final backstop.
  const { data: claimed, error: claimError } = await admin
    .from("nightly_jobs")
    .update({
      status: "running",
      attempts: job.attempts + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      last_error: null,
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("attempts", job.attempts)
    .select("id, status, attempts, started_at")
    .maybeSingle<NightlyJob>();
  if (claimError) throw new Error(`Could not claim nightly job: ${claimError.message}`);
  return claimed || "done";
}

async function generateForCandidate(
  admin: AdminClient,
  candidate: Candidate,
  now: Date,
): Promise<"succeeded" | "skipped"> {
  const { companion, settings, localDate } = candidate;
  const timezone = normalizeTimeZone(settings.timezone);
  const range = getLocalDateRange(localDate, timezone);

  const job = await claimJob(admin, candidate);
  if (job === "done" || !job) return "skipped";

  try {
    const { data: existing, error: existingError } = await admin
      .from("dream_entries")
      .select("id")
      .eq("companion_id", companion.id)
      .eq("local_date", localDate)
      .in("status", ["draft", "published"])
      .maybeSingle();
    if (existingError) throw new Error(`Could not check existing Dream: ${existingError.message}`);
    if (existing) {
      await finishJob(admin, job.id, "succeeded", range);
      return "succeeded";
    }

    const { data: sessions, error: sessionsError } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("companion_id", companion.id);
    if (sessionsError) throw new Error(`Could not read chat sessions: ${sessionsError.message}`);
    const sessionIds = (sessions || []).map((session) => session.id);
    if (sessionIds.length === 0) {
      await finishJob(admin, job.id, "skipped", range);
      return "skipped";
    }

    const { data: rawMessages, error: messagesError } = await admin
      .from("chat_messages")
      .select("id, role, content, created_at")
      .in("session_id", sessionIds)
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .order("created_at", { ascending: true })
      .limit(80);
    if (messagesError) throw new Error(`Could not read daily messages: ${messagesError.message}`);

    const messages = (rawMessages || [])
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .slice(-60) as Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        created_at: string;
      }>;

    // An assistant-only greeting is not enough material for a Dream.
    if (!messages.some((message) => message.role === "user")) {
      await finishJob(admin, job.id, "skipped", range);
      return "skipped";
    }

    const memoriesPromise = settings.memory_enabled
      ? admin
          .from("memory_summaries")
          .select("id, summary")
          .eq("companion_id", companion.id)
          .order("importance", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null });
    const eventsPromise = admin
      .from("relationship_events")
      .select("id, description")
      .eq("companion_id", companion.id)
      .order("occurred_at", { ascending: false })
      .limit(5);

    const [memoriesResult, eventsResult] = await Promise.all([memoriesPromise, eventsPromise]);
    if (memoriesResult.error) throw new Error(`Could not read memories: ${memoriesResult.error.message}`);
    if (eventsResult.error) throw new Error(`Could not read events: ${eventsResult.error.message}`);

    const memories = (memoriesResult.data || []).map((memory) => ({
      id: memory.id,
      text: memory.summary,
    }));
    const events = (eventsResult.data || []).map((event) => ({
      id: event.id,
      text: event.description,
    }));

    const { dream, model } = await generateDream({
      companionName: companion.companion_name || "Amara",
      userNickname: companion.user_nickname,
      persona: companion.persona || "gentle",
      relationshipType: companion.relationship_type,
      relationshipStage: companion.relationship_stage || 5,
      localDate,
      timezone,
      locale: settings.locale || "en",
      messages,
      memories,
      events,
    });

    const dreamText = [dream.title, dream.content, dream.emotional_theme, dream.next_day_hook].filter(Boolean).join("\n");
    const locale = settings.locale.toLowerCase().startsWith("zh") ? "zh" : "en";
    if (!await scanWaffoContent(dreamText, locale, "dream")) {
      throw new Error("Dream did not pass content safety review");
    }

    const { error: dreamInsertError } = await admin.from("dream_entries").insert({
      companion_id: companion.id,
      local_date: localDate,
      timezone,
      ...dream,
      model,
      prompt_version: DREAM_PROMPT_VERSION,
      status: "published",
      generated_at: now.toISOString(),
    });

    if (dreamInsertError) {
      // A concurrent retry may have won the daily slot after generation. Treat
      // that as idempotent success rather than creating a second Dream.
      if (dreamInsertError.code === "23505") {
        await finishJob(admin, job.id, "succeeded", range);
        return "succeeded";
      }
      throw new Error(`Could not save Dream: ${dreamInsertError.message}`);
    }

    await finishJob(admin, job.id, "succeeded", range);
    return "succeeded";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown nightly generation error";
    await finishJob(admin, job.id, "failed", range, message);
    throw error;
  }
}

export async function runNightlyJobs(now = new Date()): Promise<NightlySummary> {
  const admin = createServerAdminClient();
  const summary: NightlySummary = {
    scanned: 0,
    due: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    already_processed: 0,
  };

  const { data: companions, error: companionsError } = await admin
    .from("companions")
    .select("id, user_id, relationship_type, companion_name, user_nickname, persona, relationship_stage")
    .order("last_active_at", { ascending: false })
    .limit(SCAN_LIMIT);
  if (companionsError) throw new Error(`Could not scan companions: ${companionsError.message}`);

  const rows = (companions || []) as CompanionRow[];
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  const { data: settingsRows, error: settingsError } = await admin
    .from("user_settings")
    .select("user_id, locale, timezone, dream_enabled, memory_enabled")
    .in("user_id", rows.map((row) => row.user_id));
  if (settingsError) throw new Error(`Could not read user settings: ${settingsError.message}`);

  const { data: membershipRows, error: membershipError } = await admin
    .from("profiles")
    .select("id, membership_type, membership_expires_at, manual_membership_type, manual_membership_expires_at")
    .in("id", rows.map((row) => row.user_id));
  if (membershipError) throw new Error(`Could not read memberships: ${membershipError.message}`);

  const settingsByUser = new Map((settingsRows || []).map((settings) => [settings.user_id, settings]));
  const membershipByUser = new Map((membershipRows || []).map((membership) => [membership.id, membership]));
  const candidates: Candidate[] = [];
  for (const companion of rows) {
    const settings = settingsByUser.get(companion.user_id) || defaultSettings(companion.user_id);
    if (activeMembershipTier(membershipByUser.get(companion.user_id), now) === "free") continue;
    if (!settings.dream_enabled) continue;
    const timezone = normalizeTimeZone(settings.timezone);
    if (!isLocalNightlyWindow(now, timezone)) continue;
    candidates.push({
      companion,
      settings: { ...settings, timezone },
      localDate: getLocalDate(now, timezone),
    });
  }
  summary.due = candidates.length;

  for (const candidate of candidates) {
    try {
      const before = await admin
        .from("nightly_jobs")
        .select("status")
        .eq("companion_id", candidate.companion.id)
        .eq("job_type", "all")
        .eq("local_date", candidate.localDate)
        .maybeSingle();
      const result = await generateForCandidate(admin, candidate, now);
      if (result === "succeeded") summary.succeeded += 1;
      else if (before.data?.status === "succeeded" || before.data?.status === "skipped") {
        summary.already_processed += 1;
      } else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        "[nightly] companion generation failed",
        candidate.companion.id,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  return summary;
}
