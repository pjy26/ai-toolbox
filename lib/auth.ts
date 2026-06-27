import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 陪伴对话的免费额度
export const FREE_MESSAGE_LIMIT = 30;

// 会员判断
export async function getMembershipStatus(userId: string): Promise<{
  isMember: boolean;
  membershipType: string | null;
  expiresAt: string | null;
  freeMessagesUsed: number;
}> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from("profiles")
    .select("membership_type, membership_expires_at, free_messages_used, credits")
    .eq("id", userId)
    .single();

  if (!data) {
    return { isMember: false, membershipType: null, expiresAt: null, freeMessagesUsed: 0 };
  }

  const isMember =
    !!data.membership_type &&
    data.membership_type !== "free" &&
    !!data.membership_expires_at &&
    new Date(data.membership_expires_at) > new Date();

  return {
    isMember,
    membershipType: data.membership_type,
    expiresAt: data.membership_expires_at,
    freeMessagesUsed: data.free_messages_used || 0,
  };
}

// 陪伴对话配额校验：会员无限；非会员前 30 句免费
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
    .select("credits, membership_type, membership_expires_at")
    .eq("id", userId)
    .single();

  if (!data) return { ok: false, credits: 0, isMember: false };

  const isMember =
    data.membership_type !== "free" &&
    data.membership_expires_at &&
    new Date(data.membership_expires_at) > new Date();

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
