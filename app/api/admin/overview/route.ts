import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServerAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type ProductEventRow = {
  id: string;
  user_id: string;
  companion_id: string | null;
  event_name: string;
  locale: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type UserSignals = {
  chatReplies: number;
  memoryExtracts: number;
  chatDays: number;
  lastActiveAt: string | null;
  lastError: { code: string; at: string } | null;
  paywallViews: number;
  quotaExhausted: number;
};

const emptySignals = (): UserSignals => ({
  chatReplies: 0,
  memoryExtracts: 0,
  chatDays: 0,
  lastActiveAt: null,
  lastError: null,
  paywallViews: 0,
  quotaExhausted: 0,
});

function safeMetadata(metadata: ProductEventRow["metadata"]) {
  const safe: Record<string, string | number> = {};
  for (const key of ["reason", "planId", "status", "source", "freeMessagesUsed", "profile"]) {
    const value = metadata?.[key];
    if (typeof value === "string" || typeof value === "number") safe[key] = value;
  }
  return safe;
}

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = createServerAdminClient();
  const now = new Date().toISOString();
  const [
    authResult,
    totalResult,
    paidResult,
    manualResult,
    waffoOrdersResult,
    actionsResult,
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 50 }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .neq("membership_type", "free").gt("membership_expires_at", now),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .gt("manual_membership_expires_at", now),
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("provider", "waffo").eq("status", "paid"),
    supabase.from("admin_membership_actions").select("*")
      .order("created_at", { ascending: false }).limit(12),
  ]);

  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });
  const countError = totalResult.error || paidResult.error || manualResult.error || waffoOrdersResult.error;
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const authUsers = authResult.data.users;
  const userIds = authUsers.map((user) => user.id);
  const [profilesResult, ordersResult, eventsResult] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select(
          "id, username, membership_type, membership_expires_at, membership_provider_order_id, membership_auto_renew, manual_membership_type, manual_membership_expires_at, manual_membership_granted_at, manual_membership_reason, created_at, free_messages_used",
        ).in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("orders").select("user_id, provider_order_id, plan_id, subscription_status, current_period_end, auto_renew, status, created_at")
          .eq("provider", "waffo").in("user_id", userIds).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("product_events")
          .select("id, user_id, companion_id, event_name, locale, metadata, created_at")
          .in("user_id", userIds).order("created_at", { ascending: false }).limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  if (ordersResult.error) return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  if (actionsResult.error) return NextResponse.json({ error: actionsResult.error.message }, { status: 500 });

  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  const latestOrders = new Map<string, (typeof ordersResult.data)[number]>();
  for (const order of ordersResult.data) {
    if (!latestOrders.has(order.user_id)) latestOrders.set(order.user_id, order);
  }

  // Only operational events and bounded error codes are read. Chat, memory,
  // Dream, and letter content tables are deliberately not part of this API.
  const eventRows = (eventsResult.data || []) as ProductEventRow[];
  const signals = new Map<string, UserSignals>(userIds.map((id) => [id, emptySignals()]));
  const chatDays = new Map<string, Set<string>>();
  const recentErrorUsers = new Set<string>();
  const recentErrorCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const event of eventRows) {
    const metric = signals.get(event.user_id);
    if (!metric) continue;
    if (!metric.lastActiveAt) metric.lastActiveAt = event.created_at;
    if (event.event_name === "chat_reply_completed") {
      metric.chatReplies += 1;
      const days = chatDays.get(event.user_id) || new Set<string>();
      days.add(event.created_at.slice(0, 10));
      chatDays.set(event.user_id, days);
    } else if (event.event_name === "memory_extract_completed") {
      metric.memoryExtracts += 1;
    } else if (event.event_name === "paywall_viewed") {
      metric.paywallViews += 1;
    } else if (event.event_name === "quota_exhausted") {
      metric.quotaExhausted += 1;
    } else if (event.event_name === "chat_reply_failed" || event.event_name === "memory_extract_failed") {
      if (!metric.lastError) {
        metric.lastError = { code: String(event.metadata?.reason || event.event_name).slice(0, 80), at: event.created_at };
      }
      if (Date.parse(event.created_at) >= recentErrorCutoff) recentErrorUsers.add(event.user_id);
    }
  }
  chatDays.forEach((days, userId) => {
    const metric = signals.get(userId);
    if (metric) metric.chatDays = days.size;
  });

  return NextResponse.json({
    stats: {
      totalUsers: totalResult.count || 0,
      paidMembers: paidResult.count || 0,
      manualMembers: manualResult.count || 0,
      waffoPaidOrders: waffoOrdersResult.count || 0,
      returningChatters: Array.from(signals.values()).filter((metric) => metric.chatDays >= 2).length,
      usersWithMemory: Array.from(signals.values()).filter((metric) => metric.memoryExtracts > 0).length,
      recentErrorUsers: recentErrorUsers.size,
    },
    diagnosticsAvailable: !eventsResult.error,
    diagnosticsError: eventsResult.error?.message || null,
    diagnosticsTruncated: eventRows.length === 2000,
    users: authUsers.map((authUser) => ({
      id: authUser.id,
      email: authUser.email || null,
      lastSignInAt: authUser.last_sign_in_at || null,
      profile: profiles.get(authUser.id) || null,
      waffo: latestOrders.get(authUser.id) || null,
      signals: signals.get(authUser.id) || emptySignals(),
    })),
    recentActions: actionsResult.data,
    recentEvents: eventRows.slice(0, 40).map((event) => ({
      id: event.id,
      user_id: event.user_id,
      companion_id: event.companion_id,
      event_name: event.event_name,
      locale: event.locale,
      metadata: safeMetadata(event.metadata),
      created_at: event.created_at,
    })),
  });
}
