import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 判断用户当前是否为有效会员（月度/年度/周卡，未过期）
export async function isUserMember(userId: string): Promise<boolean> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from("profiles")
    .select("membership_type, membership_expires_at")
    .eq("id", userId)
    .single();

  if (!data) return false;
  if (!data.membership_type || data.membership_type === "free") return false;
  if (!data.membership_expires_at) return false;
  return new Date(data.membership_expires_at) > new Date();
}

// 会员可不扣积分直接通过；非会员走积分校验
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

  // 会员：对话类工具（companion / chat）免扣积分
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
