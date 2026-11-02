import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 陪伴对话的免费额度
export const FREE_MESSAGE_LIMIT = 20;

// 会员判断：付费权益与管理员赠送权益分别保存，取当前更晚的到期时间。
export async function getMembershipStatus(userId: string): Promise<{
  isMember: boolean;
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
    return { isMember: false, membershipType: null, expiresAt: null, membershipSource: null, freeMessagesUsed: 0 };
  }

  const now = new Date();
  const paidExpiry = data.membership_expires_at ? new Date(data.membership_expires_at) : null;
  const manualExpiry = data.manual_membership_expires_at ? new Date(data.manual_membership_expires_at) : null;
  const paidActive = !!data.membership_type && data.membership_type !== "free" && !!paidExpiry && paidExpiry > now;
  const manualActive = !!data.manual_membership_type && !!manualExpiry && manualExpiry > now;
  const useManual = manualActive && (!paidActive || (manualExpiry && paidExpiry && manualExpiry > paidExpiry));

  return {
    isMember: paidActive || manualActive,
    membershipType: useManual ? data.manual_membership_type : data.membership_type,
    expiresAt: useManual ? data.manual_membership_expires_at : data.membership_expires_at,
    membershipSource: useManual ? "manual" : paidActive ? "paid" : null,
    freeMessagesUsed: data.free_messages_used || 0,
  };
}

// 陪伴对话配额校验：会员无限；非会员前 20 句免费
export async function checkCompanionQuota(userId: string) {
  const status = await getMembershipStatus(userId);
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

// 通用工具仍然用积分
export async function checkCredits(userId: string, required: number) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from("profiles")
    .select("credits, membership_type, membership_expires_at, manual_membership_type, manual_membership_expires_at")
    .eq("id", userId)
    .single();

  if (!data) return { ok: false, credits: 0, isMember: false };

  const now = new Date();
  const paidActive =
    data.membership_type !== "free" &&
    !!data.membership_expires_at &&
    new Date(data.membership_expires_at) > now;
  const manualActive =
    !!data.manual_membership_type &&
    !!data.manual_membership_expires_at &&
    new Date(data.manual_membership_expires_at) > now;
  const isMember = paidActive || manualActive;

  return { ok: isMember || data.credits >= required, credits: data.credits, isMember };
}

export async function deductCredits(userId: string, amount: number) {
  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  return !error;
}

export async function logUsage(userId: string, toolKey: string, cost: number) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.from("usage_logs").insert({
    user_id: userId,
    tool_key: toolKey,
    credits_cost: cost,
  });
}
