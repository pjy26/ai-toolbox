import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { readChatInput } from "@/lib/chat-input";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { runCompanionTurn } from "@/lib/companion-turn";

export const maxDuration = 30; // seconds, Vercel Pro required for >15

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const input = await readChatInput(req);
  if (!input) {
    return NextResponse.json(
      { error: "请输入不超过 4000 字符的消息。", code: "INVALID_CHAT_INPUT" },
      { status: 400 },
    );
  }
  const supabase = await createRouteHandlerClient();
  return runCompanionTurn({
    userId: user.id,
    input: input as any,
    signal: req.signal,
    supabase,
  });
}
