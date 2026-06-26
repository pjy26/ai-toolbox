import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 获取某次会话的消息
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "缺少 session_id" }, { status: 400 });

  // 校验会话归属
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id, companion_id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();
  if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages, companion_id: session.companion_id });
}
