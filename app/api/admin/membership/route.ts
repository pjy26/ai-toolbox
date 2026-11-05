import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServerAdminClient } from "@/lib/supabase";
import type { CheckoutPlanId } from "@/lib/membership-plans";

export const runtime = "nodejs";

const PLAN_DAYS = { plus_trial: 7, plus_monthly: 30, plus_yearly: 365, premium_monthly: 30, premium_yearly: 365 } as const;
type PlanId = keyof typeof PLAN_DAYS;

export async function POST(req: Request) {
  const { user: admin, error: authError } = await requireAdmin();
  if (authError) return authError;

  let body: { action?: string; userId?: string; planId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  const targetUserId = body.userId?.trim();
  const reason = body.reason?.trim().slice(0, 500) || "";
  if (!targetUserId || (action !== "grant" && action !== "revoke")) {
    return NextResponse.json({ error: "A valid action and userId are required" }, { status: 400 });
  }

  const planId = body.planId as PlanId | undefined;
  if (action === "grant" && (!planId || !(planId in PLAN_DAYS))) {
    return NextResponse.json({ error: "A valid planId is required" }, { status: 400 });
  }

  const supabase = createServerAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, manual_membership_expires_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  let expiresAt: string | null = null;
  let profileUpdate: Record<string, unknown>;

  if (action === "grant" && planId) {
    const currentExpiry = profile.manual_membership_expires_at
      ? new Date(profile.manual_membership_expires_at)
      : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiry = new Date(base);
    expiry.setUTCDate(expiry.getUTCDate() + PLAN_DAYS[planId]);
    expiresAt = expiry.toISOString();
    profileUpdate = {
      manual_membership_type: planId,
      manual_membership_expires_at: expiresAt,
      manual_membership_granted_by: admin.id,
      manual_membership_granted_at: now.toISOString(),
      manual_membership_reason: reason,
    };
  } else {
    profileUpdate = {
      manual_membership_type: null,
      manual_membership_expires_at: null,
      manual_membership_granted_by: null,
      manual_membership_granted_at: null,
      manual_membership_reason: null,
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", targetUserId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: auditError } = await supabase.from("admin_membership_actions").insert({
    admin_user_id: admin.id,
    target_user_id: targetUserId,
    action,
    plan_id: action === "grant" ? planId : null,
    expires_at: expiresAt,
    reason,
  });
  if (auditError) {
    console.error("Admin membership audit failed", auditError.message);
    return NextResponse.json({ error: "Membership changed, but the audit record could not be saved" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action, userId: targetUserId, planId: action === "grant" ? planId : null, expiresAt });
}
