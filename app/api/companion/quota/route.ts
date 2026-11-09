import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";

// 返回当前用户的会员状态。对话次数对所有方案都不设上限，
// 因此这里不再返回 freeLimit / remaining：Free 与 Plus 的差异只在功能。
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const status = await getMembershipStatus(user.id);
  return NextResponse.json({
    isMember: status.isMember,
    tier: status.tier,
    membershipType: status.membershipType,
    expiresAt: status.expiresAt,
    membershipSource: status.membershipSource,
  });
}
