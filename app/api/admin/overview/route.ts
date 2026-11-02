import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServerAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

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
  const [profilesResult, ordersResult] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select(
          "id, username, membership_type, membership_expires_at, membership_provider_order_id, membership_auto_renew, manual_membership_type, manual_membership_expires_at, manual_membership_granted_at, manual_membership_reason, created_at, free_messages_used",
        ).in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("orders").select("user_id, provider_order_id, plan_id, subscription_status, current_period_end, auto_renew, status, created_at")
          .eq("provider", "waffo").in("user_id", userIds).order("created_at", { ascending: false }).limit(200)
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

  return NextResponse.json({
    stats: {
      totalUsers: totalResult.count || 0,
      paidMembers: paidResult.count || 0,
      manualMembers: manualResult.count || 0,
      waffoPaidOrders: waffoOrdersResult.count || 0,
    },
    users: authUsers.map((authUser) => ({
      id: authUser.id,
      email: authUser.email || null,
      lastSignInAt: authUser.last_sign_in_at || null,
      profile: profiles.get(authUser.id) || null,
      waffo: latestOrders.get(authUser.id) || null,
    })),
    recentActions: actionsResult.data,
  });
}
