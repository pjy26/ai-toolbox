import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { membershipTier, type MembershipTier } from "@/lib/membership-plans";

export async function getAuthUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 每个账号可免费发送 30 句；Free 使用基础记忆功能，Plus 开放完整关系功能。
export const FREE_MESSAGE_LIMIT = 30;

// 会员判断：付费权益与管理员赠送权益分别保存，取当前更晚的到期时间。
export async function getMembershipStatus(userId: string): Promise<{
  isMember: boolean;
  tier: MembershipTier;
  membershipType: string | null;
  expiresAt: string | null;
  membershipSource: "paid" | "manual" | null;
  freeMessagesUsed: number;
}> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from("profiles")
    .select("membership_type, membership_expires_at, manual_membership_type, manual_membership_expires_at, free_messages_used, credits")
    .eq("id", userId)
    .single();

  if (!data) {
    return { isMember: false, tier: "free", membershipType: null, expiresAt: null, membershipSource: null, freeMessagesUsed: 0 };
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
    freeMessagesUsed: data.free_messages_used || 0,
  };
}

export function getCompanionQuotaDecision(status: { isMember: boolean; freeMessagesUsed: number }) {
  const remaining = status.isMember
    ? Infinity
    : Math.max(0, FREE_MESSAGE_LIMIT - status.freeMessagesUsed);
  return {
    ok: status.isMember || status.freeMessagesUsed < FREE_MESSAGE_LIMIT,
    isMember: status.isMember,
    used: status.freeMessagesUsed,
    remaining,
  };
}

// 陪伴对话配额校验：会员无限；非会员前 30 句免费且功能完整
export async function checkCompanionQuota(userId: string) {
  return getCompanionQuotaDecision(await getMembershipStatus(userId));
}

// 增加免费消息计数（会员不增）
export async function incFreeMessageCount(userId: string) {
  const status = await getMembershipStatus(userId);
  if (status.isMember) return;
  const supabase = createRouteHandlerClient({ cookies });
  await supabase
    .from("profiles")
    .update({ free_messages_used: (status.freeMessagesUsed || 0) + 1 })
    .eq("id", userId);
}

