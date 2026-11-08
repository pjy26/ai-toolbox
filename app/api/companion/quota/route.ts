import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { membershipTier } from "@/lib/membership-plans";
import { NextResponse } from "next/server";

// 返回当前用户的会员状态。Free 对话不设消息数量上限。
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const status = await getMembershipStatus(user.id);
  return NextResponse.json({
    isMember: status.isMember,
    tier: membershipTier(status.membershipType),
    membershipType: status.membershipType,
    expiresAt: status.expiresAt,
    membershipSource: status.membershipSource,
  });
}
