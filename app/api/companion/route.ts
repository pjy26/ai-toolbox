import {
  getAuthUser,
  checkCompanionQuota,
  incFreeMessageCount,
} from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 30; // seconds, Vercel Pro required for >15
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { computeStageAdvance, type PersonaType } from "@/lib/amara-persona";
import { buildFriendSystemPrompt, buildLoverSystemPrompt } from "@/lib/amara-prompt";
import { semanticRecall } from "@/lib/memory-retrieval";
import { isMemoryEnabled } from "@/lib/user-settings";
import { dedupeMemoryEntries, isExpiredTransientMemory } from "@/lib/memory-reliability";
import {
  conversationTimeBlock,
  daysSinceLastChat,
  lastChatContext,
  normalizeConversationLocale,
  outputLanguageBlock,
} from "@/lib/conversation-context";
import { contentSafetyMessage, scanWaffoContent } from "@/lib/content-safety";

// 即时状态不是长期事实。初版先使用保守 TTL，避免昨天/上周的状态被描述成“此刻”。
const LIVE_STATE_TTL_MS = 6 * 60 * 60 * 1000;
const EMOTION_STATE_TTL_MS = 12 * 60 * 60 * 1000;

function getFreshState<T extends Record<string, any>>(
  state: T | null | undefined,
  ttlMs: number,
  nowMs = Date.now()
): T | null {
  if (!state) return null;
  const updatedAt = typeof state.updated_at === "string" ? Date.parse(state.updated_at) : NaN;
  // 没有可信时间戳的旧状态同样不再当作当前状态使用。
  if (!Number.isFinite(updatedAt) || nowMs - updatedAt > ttlMs) return null;
  return state;
}

// ====== 健康/veto 记忆：把陈述句翻译成行为约束 ======
// 睡眠差/生病/生理期这类信息是 veto 信息，不是参考信息。
// 陈述句（"用户最近睡眠差"）只是背景知识，模型生成时容易被覆盖；
// 必须翻译成行为约束、放在记忆列表之前，模型才会把它当行为前提。
// 命中约束的记忆从普通记忆列表移出，避免一段陈述一段约束互相稀释。
const VETO_RULES: { pattern: RegExp; constraint: { zh: string; en: string } }[] = [
  { pattern: /睡眠|失眠|熬夜|睡不好|睡不着|sleep|insomnia/i, constraint: { zh: "避免提咖啡/浓茶/熬夜邀约/太刺激的活动，晚上主动提醒 TA 早点休息", en: "Avoid caffeine, late-night plans, and overstimulating activities; gently encourage rest." } },
  { pattern: /生病|感冒|发烧|咳嗽|嗓子疼|头疼|头痛|头晕|难受|sick|ill|fever|cough|headache|dizzy/i, constraint: { zh: "TA 身体不舒服——避免外出/运动/聚餐类邀约，多关心身体和休息", en: "They may be unwell; avoid outings, exercise, or parties and prioritize rest." } },
  { pattern: /胃痛|胃疼|胃不舒服|肠胃|stomach/i, constraint: { zh: "TA 胃不舒服——避免推荐辛辣、生冷、咖啡、酒", en: "Avoid suggesting spicy food, cold drinks, caffeine, or alcohol." } },
  { pattern: /生理期|月经|例假|姨妈|period|menstru/i, constraint: { zh: "TA 在生理期——避免冷饮、剧烈运动类邀约，多体贴照顾", en: "Be considerate and avoid pushing strenuous activity." } },
  { pattern: /受伤|扭伤|骨折|手术|住院|injur|sprain|fracture|surgery|hospital/i, constraint: { zh: "TA 有伤/在恢复期——避免运动、奔波类邀约", en: "They may be recovering; avoid exercise or tiring travel suggestions." } },
  { pattern: /过敏|allerg/i, constraint: { zh: "TA 有过敏——推荐吃的或活动前先想一层是否会触发", en: "Check for possible allergens before suggesting food or activities." } },
];

function splitVetoMemories(memText: string, locale: "en" | "zh"): { vetoText: string; restText: string } {
  if (!memText) return { vetoText: "", restText: "" };
  const vetoLines: string[] = [];
  const restLines: string[] = [];
  const usedConstraints = new Set<string>();
  for (const line of memText.split("\n")) {
    const hit = VETO_RULES.find((r) => r.pattern.test(line));
    if (hit) {
      const constraint = hit.constraint[locale];
      const tail = usedConstraints.has(constraint) ? "" : ` — ${constraint}`;
      usedConstraints.add(constraint);
      vetoLines.push(`${locale === "en" ? "- Care note:" : "- 【注意】"}${line.replace(/^-\s*/, "")}${tail}`);
    } else {
      restLines.push(line);
    }
  }
  return { vetoText: vetoLines.join("\n"), restText: restLines.join("\n") };
}

interface CompanionRow {
  id: string;
  user_id: string;
  relationship_type: string;
  gender: string | null;
  companion_name: string | null;
  user_nickname: string | null;
  persona: PersonaType;
  persona_locked_at?: string | null;
  relationship_stage: number;
  stage_date?: string | null;
  stage_day_count?: number | null;
  emotion_state?: Record<string, any> | null;
  live_state?: { current_activity?: string; mood?: string; last_topic?: string } | null;
  last_active_at?: string | null;
}

interface ProfileRow {
  profile: Record<string, any> | null;
}

function profileToText(profile: Record<string, any> | null, locale: "en" | "zh"): string {
  if (!profile || Object.keys(profile).length === 0) return "";
  const lines: string[] = [];
  const separator = locale === "en" ? "; " : "；";
  const labels = locale === "en"
    ? { basic: "Basic info", preferences: "Preferences", people: "Important people", ongoing: "Previously ongoing matters", personality: "Personality notes", other: "Other records" }
    : { basic: "基本信息", preferences: "偏好", people: "重要的人", ongoing: "正在经历的事", personality: "性格特点", other: "其他" };
  const basic = profile.basic_info;
  if (basic && typeof basic === "object") {
    const parts = Object.entries(basic).map(([k, v]) => `${k}: ${v}`).join(separator);
    if (parts) lines.push(`${locale === "en" ? "" : "【"}${labels.basic}${locale === "en" ? ":" : "】"}${parts}`);
  }
  if (profile.preferences && Object.keys(profile.preferences).length > 0) {
    const parts = Object.entries(profile.preferences).map(([k, v]) => `${k}: ${v}`).join(separator);
    if (parts) lines.push(`${locale === "en" ? "" : "【"}${labels.preferences}${locale === "en" ? ":" : "】"}${parts}`);
  }
  if (Array.isArray(profile.important_people) && profile.important_people.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.people}${locale === "en" ? ":" : "】"}${profile.important_people.map((p: any) => typeof p === "string" ? p : JSON.stringify(p)).join(separator)}`);
  }
  if (Array.isArray(profile.ongoing_matters) && profile.ongoing_matters.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.ongoing}${locale === "en" ? ":" : "】"}${profile.ongoing_matters.join(separator)}`);
  }
  if (profile.personality_notes) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.personality}${locale === "en" ? ":" : "】"}${profile.personality_notes}`);
  }
  if (Array.isArray(profile.key_facts) && profile.key_facts.length > 0) {
    lines.push(`${locale === "en" ? "" : "【"}${labels.other}${locale === "en" ? ":" : "】"}${profile.key_facts.join(separator)}`);
  }
  return lines.join("\n");
}

function eventsToText(events: { description: string; event_type?: string | null }[] | undefined): string {
  if (!events || events.length === 0) return "";
  return events.map((e) => `- ${e.description}`).join("\n");
}

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

  // 2. 长期记忆 = 会员特权；用户性别对所有人生效（影响相处分寸，不属于记忆）
  let profileText = "";
  let memText = "";
  let eventsText = "";
  const { data: userProfileRow } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .maybeSingle();
  const userGender: string = (userProfileRow as any)?.gender || "";
  const memoryEnabled = await isMemoryEnabled(supabase, user.id);
  if (isMember && memoryEnabled) {
    // 语义检索：用户消息 embedding → 事实型 top6 + 经历型 top3（混合排序）
    // 返回 null = 短消息/超时/失败 → 退回原来的 importance 排序降级路径
    const recall = await semanticRecall(supabase, companion_id, message);

    const { data: profileRow } = await supabase
      .from("user_profiles").select("profile").eq("companion_id", companion_id).maybeSingle<ProfileRow>();
    profileText = profileToText(profileRow?.profile || null, locale);

    if (recall) {
      memText = recall.memories.map((s) => `- ${s.summary}`).join("\n");
      eventsText = eventsToText(recall.events);
    } else {
      // 短消息或 embedding 失败时只保留少量高重要性记忆，避免一次塞入大量无关内容。
      const { data: summaries, error: fallbackError } = await supabase
        .from("memory_summaries")
        .select("summary, importance, created_at, updated_at")
        .eq("companion_id", companion_id)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(15);
      if (fallbackError) console.error("记忆降级检索失败:", fallbackError.message);
      memText = dedupeMemoryEntries(
        (summaries as any[] || []),
        (memory) => memory.summary,
        (memory) => isExpiredTransientMemory(memory.summary, memory.updated_at || memory.created_at),
      ).slice(0, 5).map((memory) => `- ${memory.summary}`).join("\n");
    }
  }

  // 3. relationship_events —— Step 1 已接入：eventsText 在上方语义检索/降级路径中赋值

  // 3.5 健康/veto 记忆单独成段：陈述句翻译成行为约束，置于记忆列表之前
  const { vetoText, restText } = splitVetoMemories(memText, locale);
  memText = restText;

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

  // 9. 组装 messages。完整日期、距上次聊天的本地自然日数和输出语言都是硬锚点。
  const now = new Date();
  const daysApart = daysSinceLastChat(companion.last_active_at, now, timezone);
  const currentTime = conversationTimeBlock(now, timezone, locale);
  const lastChat = lastChatContext(daysApart, locale);
  let systemPrompt: string;
  if (companion.relationship_type === "lover") {
    systemPrompt = buildLoverSystemPrompt({
      locale,
      persona: companion.persona || "gentle",
      companion_gender: companion.gender || "不限",
      nickname: companion.user_nickname || "",
      companion_name: companion.companion_name || "",
      current_time: currentTime,
      last_chat_context: lastChat,
      relationship_stage: companion.relationship_stage || 5,
      emotion_state: freshEmotionState,
      user_profile: profileText,
      memory_summaries: memText,
      user_gender: userGender,
      live_state: freshLiveState,
      events_text: eventsText,
      veto_text: vetoText,
    });
  } else {
    systemPrompt = buildFriendSystemPrompt({
      locale,
      companion_gender: companion.gender || "不限",
      companion_name: companion.companion_name || "",
      nickname: companion.user_nickname || "",
      user_profile: profileText,
      memory_summaries: memText,
      current_time: currentTime,
      last_chat_context: lastChat,
    });
  }
  systemPrompt += `\n\n${outputLanguageBlock(locale)}`;

  const mergedHistory = (dbHistory as { role: string; content: string }[] | null) || [];

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const h of mergedHistory) {
    if (h.role === "user" || h.role === "assistant") {
      messages.push({ role: h.role, content: h.content });
    }
  }
  if (Array.isArray(history)) {
    // 客户端补传的历史与 DB 拉取的大概率是同一批消息——按 role+content 去重，
    // 避免同一条对话在 prompt 里出现两次（浪费窗口、稀释注意力）
    const seen = new Set(mergedHistory.map((h) => `${h.role}|${h.content}`));
    for (const h of history.slice(-10)) {
      if ((h?.role === "user" || h?.role === "assistant") && !seen.has(`${h.role}|${h.content}`)) {
        seen.add(`${h.role}|${h.content}`);
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  messages.push({ role: "user", content: message });

  const encoder = new TextEncoder();
  const model = process.env.OPENAI_MODEL || "deepseek-v4-pro";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.deepseek.com";
  const apiKey = process.env.OPENAI_API_KEY;

  // Return streaming response immediately so Vercel extends the timeout,
  // then lazily create the OpenAI stream inside the ReadableStream.
  const readable = new ReadableStream({
    async start(controller) {
      // Send heartbeat immediately to confirm connection is alive
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      let assistantFull = "";
      try {
        const lazyOpenai = new OpenAI({ apiKey, baseURL });
        // 日常陪伴不需要高强度推理；低档位能降低延迟，也给正文留下足够额度。
        const stream = await lazyOpenai.chat.completions.create({
          model,
          messages,
          stream: true,
          temperature: 0.7,
          reasoning_effort: "low",
          max_tokens: 1600,
        });

        for await (const chunk of stream) {
          assistantFull += chunk.choices?.[0]?.delta?.content || "";
        }

        // 推理额度耗尽时可能只返回 reasoning_content。空正文必须用非思考模式重试，
        // 不能把一次空响应直接当作用户可见的聊天失败。
        if (!assistantFull.trim()) {
          console.warn("[companion POST] 模型首次返回空正文，切换非思考模式重试");
          const fallbackStream = await lazyOpenai.chat.completions.create({
            model,
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 1000,
            thinking: { type: "disabled" },
          } as OpenAI.ChatCompletionCreateParamsStreaming);
          for await (const chunk of fallbackStream) {
            assistantFull += chunk.choices?.[0]?.delta?.content || "";
          }
        }

        if (!assistantFull.trim()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: locale === "zh" ? "我这次没能组织好语言，请再发一次。" : "I couldn’t put my thoughts into words. Please send that again.", code: "EMPTY_MODEL_RESPONSE" })}\n\n`));
          controller.close();
          return;
        }

        // Generated content must be reviewed before it is shown or persisted.
        if (!await scanWaffoContent(assistantFull, locale, "output")) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: contentSafetyMessage(locale, "output"), code: "OUTPUT_REVIEW_FAILED" })}\n\n`));
          controller.close();
          return;
        }
        for (let offset = 0; offset < assistantFull.length; offset += 24) {
          const chunk = { choices: [{ delta: { content: assistantFull.slice(offset, offset + 24) } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

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

        controller.close();
      } catch (err: any) {
        console.error("Stream error:", err instanceof Error ? err.message : "Unknown error");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: contentSafetyMessage(locale, "output") })}\n\n`));
        controller.close();
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
