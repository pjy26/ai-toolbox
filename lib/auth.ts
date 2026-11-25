import { createRouteHandlerClient } from "@/lib/supabase-server";
import { membershipTier, type MembershipTier } from "@/lib/membership-plans";

export async function getAuthUser() {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 对话次数对所有方案都不设上限；免费与付费的差异只在功能（见 lib/access.ts）。
// 会员判断：付费权益与管理员赠送权益分别保存，取当前更晚的到期时间。
export async function getMembershipStatus(userId: string, client?: any): Promise<{
  isMember: boolean;
  tier: MembershipTier;
  membershipType: string | null;
  expiresAt: string | null;
  membershipSource: "paid" | "manual" | null;
}> {
  const supabase = client || await createRouteHandlerClient();
  const { data } = await supabase
    .from("profiles")
    .select("membership_type, membership_expires_at, manual_membership_type, manual_membership_expires_at")
    .eq("id", userId)
    .single();

  if (!data) {
    return { isMember: false, tier: "free", membershipType: null, expiresAt: null, membershipSource: null };
  }

  const now = new Date();
  const paidExpiry = data.membership_expires_at ? new Date(data.membership_expires_at) : null;
  const manualExpiry = data.manual_membership_expires_at ? new Date(data.manual_membership_expires_at) : null;
  const paidActive = !!data.membership_type && data.membership_type !== "free" && !!paidExpiry && paidExpiry > now;
  const manualActive = !!data.manual_membership_type && !!manualExpiry && manualExpiry > now;
  const useManual = manualActive && (!paidActive || (manualExpiry && paidExpiry && manualExpiry > paidExpiry));
  const activeType = useManual ? data.manual_membership_type : paidActive ? data.membership_type : null;

  return {
    isMember: paidActive || manualActive,
    tier: membershipTier(activeType),
    membershipType: activeType,
    expiresAt: useManual ? data.manual_membership_expires_at : data.membership_expires_at,
    membershipSource: useManual ? "manual" : paidActive ? "paid" : null,
  };
}

