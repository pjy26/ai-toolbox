import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

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

  return { ok: data.credits >= required, credits: data.credits, isMember };
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
