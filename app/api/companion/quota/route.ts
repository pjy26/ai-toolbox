import { getAuthUser, getMembershipStatus, FREE_MESSAGE_LIMIT } from "@/lib/auth";
import { NextResponse } from "next/server";

// 返回当前用户的会员状态和陪伴配额
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const status = await getMembershipStatus(user.id);
  return NextResponse.json({
    isMember: status.isMember,
    membershipType: status.membershipType,
    expiresAt: status.expiresAt,
    freeMessagesUsed: status.freeMessagesUsed,
    freeLimit: FREE_MESSAGE_LIMIT,
    remaining: status.isMember ? -1 : Math.max(0, FREE_MESSAGE_LIMIT - status.freeMessagesUsed),
  });
}
