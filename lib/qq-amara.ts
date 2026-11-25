import { createHash } from "node:crypto";
import { createServerAdminClient } from "@/lib/supabase";
import { getActiveCompanionId } from "@/lib/companions";
import { runCompanionTurn } from "@/lib/companion-turn";
import { readSavedReply } from "@/lib/chat-reply";
import {
  parseAllowedQQOpenIds,
  qqEventTurnId,
  sendQQText,
  type QQIncomingMessage,
} from "@/lib/qq-bot";

function sessionBaseTitle(message: QQIncomingMessage): string {
  if (message.kind === "c2c") return "QQ · 私聊";
  const groupKey = createHash("sha256").update(message.targetOpenId).digest("hex").slice(0, 12);
  return `QQ · 群 ${groupKey}`;
}

async function resolveCompanionId(admin: any, userId: string): Promise<string | null> {
  const configured = process.env.QQ_AMARA_COMPANION_ID?.trim();
  if (!configured) return getActiveCompanionId(admin, userId);
  const { data, error } = await admin
    .from("companions")
    .select("id")
    .eq("id", configured)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not resolve the QQ companion");
  return data?.id || null;
}

async function resolveSessionId(
  admin: any,
  userId: string,
  companionId: string,
  baseTitle: string,
  forceNew = false,
): Promise<string> {
  if (!forceNew) {
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("companion_id", companionId)
      .like("title", `${baseTitle}*`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load the QQ conversation");
    if (data?.id) return data.id;
  }
  const title = forceNew ? `${baseTitle} · ${Date.now()}` : baseTitle;
  const { data, error } = await admin
    .from("chat_sessions")
    .insert({ user_id: userId, companion_id: companionId, title })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error("Could not create the QQ conversation");
  return data.id;
}

async function sendConversationError(message: QQIncomingMessage, response: Response) {
  if (response.status === 409) return; // A duplicate webhook already has a turn in progress.
  const body: any = await response.json().catch(() => null);
  const text = body?.code === "CONTENT_REVIEW_REQUIRED" && typeof body?.error === "string"
    ? body.error
    : "我这次没能顺利回应你，稍后再发一次好吗？";
  await sendQQText(message, text);
}

export async function handleQQAmaraMessage(message: QQIncomingMessage): Promise<void> {
  if (message.content.toLowerCase() === "/whoami") {
    await sendQQText(
      message,
      `你的 QQ OpenID 是：\n${message.authorOpenId}\n\n只有实例管理员需要把它加入 QQ_ALLOWED_OPENIDS；它不是你的 QQ 号。`,
    );
    return;
  }

  const allowed = parseAllowedQQOpenIds(process.env.QQ_ALLOWED_OPENIDS);
  if (!allowed.has(message.authorOpenId)) {
    await sendQQText(message, "这个 Amara 体验实例还没有授权你的 QQ。请先发送 /whoami，再把 OpenID 交给实例管理员。");
    return;
  }

  const userId = process.env.QQ_AMARA_USER_ID?.trim();
  if (!userId) {
    await sendQQText(message, "Amara 的 QQ 账号绑定还没有配置好，请稍后再试。");
    return;
  }
  const admin = createServerAdminClient();
  const companionId = await resolveCompanionId(admin, userId);
  if (!companionId) {
    await sendQQText(message, "还没有找到可聊天的陪伴角色，请先在 Amara 网页端创建并选择 TA。");
    return;
  }
  const baseTitle = sessionBaseTitle(message);

  if (message.content.toLowerCase() === "/new") {
    await resolveSessionId(admin, userId, companionId, baseTitle, true);
    await sendQQText(message, "好，我们开一个新的近期对话。已经形成的长期记忆仍然会保留。");
    return;
  }
  if (message.content.toLowerCase() === "/help") {
    await sendQQText(message, "直接发消息就能继续聊。\n/new：新开近期对话，保留长期记忆\n/whoami：查看用于授权的 OpenID\n/help：查看这些指令");
    return;
  }
  if (!message.content) {
    await sendQQText(message, "这个体验版目前先支持文字。你想说什么，直接发给我就好。");
    return;
  }
  if (message.content.length > 4000) {
    await sendQQText(message, "这条有点长，先分成 4000 字符以内的几段发给我吧。");
    return;
  }

  const sessionId = await resolveSessionId(admin, userId, companionId, baseTitle);
  const response = await runCompanionTurn({
    userId,
    supabase: admin,
    input: {
      message: message.content,
      companion_id: companionId,
      session_id: sessionId,
      client_turn_id: qqEventTurnId(message.eventId),
      locale: "zh",
      timezone: "Asia/Shanghai",
    },
  });
  if (!response.ok) {
    await sendConversationError(message, response);
    return;
  }
  const reply = await readSavedReply(response, "QQ reply unavailable");
  await sendQQText(message, reply);
}
