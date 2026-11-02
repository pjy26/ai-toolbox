import {
  getAuthUser,
  checkCompanionQuota,
  incFreeMessageCount,
} from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 30; // seconds, Vercel Pro required for >15
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { computeStageAdvance } from "@/lib/amara-persona";
import { normalizeConversationLocale } from "@/lib/conversation-context";
import { contentSafetyMessage, reviewContentSafety, scanWaffoContent } from "@/lib/content-safety";
import {
  buildCompanionMessages,
  EMOTION_STATE_TTL_MS,
  getFreshState,
  LIVE_STATE_TTL_MS,
  loadCompanionContext,
  type CompanionRow,
} from "@/lib/companion-context";
import { generateCompanionText } from "@/lib/companion-model";
import { createCompanionStream } from "@/lib/companion-stream";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const quota = await checkCompanionQuota(user.id);
  if (!quota.ok) {
    return NextResponse.json(
      { error: "免费额度已用完", code: "QUOTA_EXCEEDED", isMember: false },
      { status: 402 }
    );
  }
  const isMember = quota.isMember;

  const supabase = createRouteHandlerClient({ cookies });
  const { message, history, companion_id, session_id, locale: requestedLocale, timezone: requestedTimezone } = await req.json();
  const locale = normalizeConversationLocale(requestedLocale);
  const timezone = typeof requestedTimezone === "string" ? requestedTimezone : "UTC";
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }
  if (!companion_id) {
    return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });
  }
  if (!await scanWaffoContent(message, locale, "input")) {
    return NextResponse.json({ error: contentSafetyMessage(locale, "input"), code: "CONTENT_REVIEW_REQUIRED" }, { status: 422 });
  }

  // 1. 验证 companion 归属 + 拉人格字段
  const { data: companion, error: compErr } = await supabase
    .from("companions")
    .select("id, user_id, relationship_type, gender, companion_name, user_nickname, persona, persona_locked_at, relationship_stage, stage_date, stage_day_count, emotion_state, live_state, last_active_at")
    .eq("id", companion_id)
    .eq("user_id", user.id)
    .single<CompanionRow>();

  if (compErr || !companion) {
    console.error("[companion POST] 查询失败", { companion_id, userId: user.id, compErr: compErr?.message, compErrCode: (compErr as any)?.code });
    return NextResponse.json({
      error: "陪伴角色不存在",
      debug: { companion_id_query: companion_id, user_id_auth: user.id, db_error: compErr?.message || null }
    }, { status: 404 });
  }

  // 2. 上下文编排：会员门槛、记忆召回、档案和健康约束保持原有规则。
  const { userGender, profileText, memText, eventsText, vetoText } = await loadCompanionContext(
    supabase,
    companion_id,
    user.id,
    isMember,
    message,
    locale,
  );

  // 4. 获取/创建会话；已有会话必须同时属于当前用户和当前角色，防止跨会话串台。
  let sessionId = session_id;
  if (sessionId) {
    const { data: ownedSession, error: sessionErr } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("companion_id", companion_id)
      .maybeSingle();
    if (sessionErr || !ownedSession) {
      console.error("[companion POST] 会话归属校验失败", { sessionId, companion_id, error: sessionErr?.message });
      return NextResponse.json({ error: "会话不存在或与角色不匹配" }, { status: 404 });
    }
  } else {
    const { data: newSession, error: sessionErr } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, companion_id, title: message.slice(0, 30) })
      .select("id")
      .single();
    if (sessionErr || !newSession) {
      return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
    }
    sessionId = newSession.id;
  }

  // 5. 拉取最近 30 条历史消息（降序取最新 → 代码反转成正序）
  const { data: dbHistoryRaw, error: historyError } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (historyError) {
    console.error("[companion POST] 历史消息读取失败:", historyError.message);
    return NextResponse.json({ error: "读取对话历史失败" }, { status: 500 });
  }
  const dbHistory = (dbHistoryRaw || []).reverse();

  // 6. 落库用户消息；写入失败时不能继续生成，否则会形成只显示、不记住的对话。
  const { error: userMessageError } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });
  if (userMessageError) {
    console.error("[companion POST] 用户消息入库失败:", userMessageError.message);
    return NextResponse.json({ error: "保存消息失败，请稍后重试" }, { status: 500 });
  }

  // 7. 非会员计数
  await incFreeMessageCount(user.id);

  const freshEmotionState = getFreshState(companion.emotion_state, EMOTION_STATE_TTL_MS);
  const freshLiveState = getFreshState(companion.live_state, LIVE_STATE_TTL_MS);

  // 8. 推进关系阶段 + 更新活跃时间（恋人版）
  const updates: any = { last_active_at: new Date().toISOString() };
  if (companion.relationship_type === "lover") {
    // 过期情绪既不进提示词，也不能继续推动关系阶段。
    const adv = computeStageAdvance({ ...companion, emotion_state: freshEmotionState });
    if (adv) Object.assign(updates, adv);
  }
  const { error: companionUpdateError } = await supabase
    .from("companions")
    .update(updates)
    .eq("id", companion_id);
  if (companionUpdateError) {
    console.error("[companion POST] 角色状态更新失败:", companionUpdateError.message);
  }

  // 9. 确定性上下文编排；模型只负责生成，不负责记忆或业务状态。
  const messages = buildCompanionMessages({
    companion,
    userGender,
    profileText,
    memText,
    eventsText,
    vetoText,
    freshEmotionState,
    freshLiveState,
    message,
    dbHistory,
    clientHistory: history,
    locale,
    timezone,
  });
  const requestId = crypto.randomUUID();
  const readable = createCompanionStream({
    locale,
    requestId,
    generate: () => generateCompanionText({
      messages,
      mode: "stream",
      temperature: 0.7,
      requestId,
      signal: req.signal,
    }),
    review: (text) => reviewContentSafety(text, locale, "output"),
    onPersist: async (assistantFull) => {
      // 入库内容与通过审核后展示的内容完全一致。
      const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: assistantFull,
      });
      if (assistantMessageError) {
        console.error("[companion POST] 助手消息入库失败:", assistantMessageError.message);
      } else {
        const { error: sessionUpdateError } = await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
        if (sessionUpdateError) console.error("[companion POST] 会话时间更新失败:", sessionUpdateError.message);
      }

      // 恋人版：异步触发隐形性格匹配
      if (companion.relationship_type === "lover" && !companion.persona_locked_at) {
        try {
          const absUrl = new URL("/api/companion/match-persona", process.env.NEXT_PUBLIC_SITE_URL || "https://amarapjy.xyz");
          fetch(absUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companion_id: companion.id }),
          }).catch(() => {});
        } catch {}
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-session-id": sessionId as string,
      "x-is-member": isMember ? "1" : "0",
    },
  });
}
