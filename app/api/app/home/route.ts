import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { DREAM_SELECT } from "@/lib/dream";
import { listMemoryRecords } from "@/lib/memory-records";
import { getActiveCompanionId } from "@/lib/companions";

export const dynamic = "force-dynamic";

const COMPANION_SELECT = "id, relationship_type, companion_name, user_nickname, relationship_stage, live_state, last_active_at";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const supabase = await createRouteHandlerClient();
  const requestedId = new URL(req.url).searchParams.get("companion_id");

  let activeCompanionId: string | null;
  let membership: Awaited<ReturnType<typeof getMembershipStatus>>;
  try {
    [activeCompanionId, membership] = await Promise.all([
      requestedId || getActiveCompanionId(supabase, user.id), getMembershipStatus(user.id),
    ]);
  } catch {
    return NextResponse.json({ error: "读取角色失败" }, { status: 500 });
  }
  const { data: companion, error: companionError } = activeCompanionId
    ? await supabase.from("companions").select(COMPANION_SELECT).eq("id", activeCompanionId).eq("user_id", user.id).maybeSingle()
    : { data: null, error: null };
  if (companionError) return NextResponse.json({ error: "读取角色失败" }, { status: 500 });
  if (!companion) {
    return NextResponse.json({
      companion: null,
      membership,
      latestDream: null,
      recentMemories: [],
      recentEvents: [],
    });
  }

  const [dreamResult, memoriesResult, eventsResult] = await Promise.all([
    membership.tier === "free" ? { data: null, error: null } : supabase
      .from("dream_entries")
      .select(DREAM_SELECT)
      .eq("companion_id", companion.id)
      .eq("status", "published")
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    listMemoryRecords(supabase, [companion.id], new Date(), 5).then(
      (records) => ({ data: records.slice(0, 5), error: null }),
      (error) => ({ data: null, error }),
    ),
    membership.tier === "free" ? { data: [], error: null } : supabase
      .from("relationship_events")
      .select("id, companion_id, description, event_type, occurred_at, importance, created_at")
      .eq("companion_id", companion.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  // Dreams and relationship events are optional modules. A missing or temporarily
  // unavailable module must not blank the whole dashboard, including Memories.
  if (dreamResult.error || memoriesResult.error || eventsResult.error) {
    console.error("[app/home] optional aggregate query failed", {
      dream: dreamResult.error?.message,
      memories: memoriesResult.error?.message,
      events: eventsResult.error?.message,
    });
  }

  return NextResponse.json({
    companion,
    membership,
    latestDream: membership.tier === "free" ? null : dreamResult.data || null,
    recentMemories: memoriesResult.data || [],
    recentEvents: membership.tier === "free" ? [] : eventsResult.data || [],
  });
}
