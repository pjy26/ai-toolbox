import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { PERSONA_BLOCKS, stageBlock, type PersonaType } from "@/lib/amara-persona";
import { isMemoryEnabled } from "@/lib/user-settings";
import {
  conversationTimeBlock,
  daysSinceLastChat,
  lastChatContext,
  normalizeConversationLocale,
  outputLanguageBlock,
} from "@/lib/conversation-context";
import { scanWaffoContent } from "@/lib/content-safety";

// 生成 Amara 的主动开场白
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companionId = searchParams.get("companion_id");
  if (!companionId) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  const supabase = createRouteHandlerClient({ cookies });

  // 1. 获取 companion
  const { data: companion, error: compErr } = await supabase
    .from("companions")
    .select("id, user_id, relationship_type, gender, companion_name, user_nickname, persona, persona_locked_at, relationship_stage, live_state, last_active_at")
    .eq("id", companionId)
    .eq("user_id", user.id)
    .single();
  if (compErr || !companion) {
    return NextResponse.json({ error: "陪伴角色不存在" }, { status: 404 });
  }

  // 2. 使用用户本地自然日计算间隔，并把结果作为不可脑补的时间约束。
  const now = new Date();
  const timezone = searchParams.get("timezone") || "UTC";
  const locale = normalizeConversationLocale(searchParams.get("locale"));
  const daysApart = daysSinceLastChat(companion.last_active_at, now, timezone);
  const timeBlock = conversationTimeBlock(now, timezone, locale);
  const absenceText = lastChatContext(daysApart, locale);

  // 上次对话结束时的实时状态（extract 异步写入）：让开场白"接着上次"，并防止行为公式化
  const liveState = companion.live_state as { current_activity?: string; mood?: string; last_topic?: string } | null;
  const liveStateText = liveState && (liveState.current_activity || liveState.last_topic)
    ? `\n上次见面时：${[
        liveState.current_activity ? `你在做「${liveState.current_activity}」` : "",
        liveState.mood ? `心情「${liveState.mood}」` : "",
        liveState.last_topic ? `你们聊到「${liveState.last_topic}」` : "",
      ].filter(Boolean).join("，")}。`
    : "";

  // 3. 开场白只读少量近期记忆；语义 embedding 留给真正的回复链路。
  // 会员状态与设置并行，档案与记忆并行，避免进入 Chat 前的串行等待。
  const [membership, memoryEnabled] = await Promise.all([
    getMembershipStatus(user.id),
    isMemoryEnabled(supabase, user.id),
  ]);
  const isMember = membership.isMember;

  let profileText = "";
  let memText = "";
  if (isMember && memoryEnabled) {
    const [profileResult, summariesResult] = await Promise.all([
      supabase.from("user_profiles").select("profile").eq("companion_id", companionId).maybeSingle(),
      supabase.from("memory_summaries")
        .select("summary, importance")
        .eq("companion_id", companionId)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    const profileRow = profileResult.data;
    if (profileRow?.profile) {
      const p = profileRow.profile as Record<string, any>;
      const parts: string[] = [];
      if (p.basic_info?.name) parts.push(`TA叫${p.basic_info.name}`);
      if (Array.isArray(p.ongoing_matters) && p.ongoing_matters.length > 0) {
        parts.push(`TA最近在：${p.ongoing_matters.slice(0, 3).join("、")}`);
      }
      if (p.personality_notes) parts.push(`TA性格：${p.personality_notes}`);
      profileText = parts.join("。");
    }
    memText = (summariesResult.data || []).map((s: any) => `- ${s.summary}`).join("\n");
  }

  // 4. 构建 prompt 让 AI 生成开场白
  const relationshipType = companion.relationship_type;
  const persona = (companion.persona || "gentle") as PersonaType;
  const companionName = companion.companion_name || "Amara";

  let prompt = `你是${companionName}，${relationshipType === "lover" ? "正在和对方谈恋爱" : "是对方一个很亲近的人"}。

现在对方来找你了。请你主动发出第一句话——不要等对方先开口。

# 背景
${timeBlock}
${absenceText}
${liveStateText}
${relationshipType === "lover" ? stageBlock(companion.relationship_stage || 5) : ""}`;

  if (isMember && (memText || profileText)) {
    prompt += `
# TA 的事（你记得的）
${memText}
${profileText}
你可以自然地提起 TA 的事，但要有时效感：
- 几天前说"在忙"的事，现在很可能已经结束——用"后来怎么样了"的问法，别默认 TA 还在做
- 同一件旧事不要每次见面都提，挑和此刻最相关的一件就够`;
  } else if (!isMember) {
    prompt += `
# 注意
你现在还不了解 TA 太多。开场白只能用"时间 + 当前时刻"的自然关心，不要假装记得 TA 说过什么具体的事。`;
  }

  prompt += `
# 性格
${PERSONA_BLOCKS[persona].slice(0, 200)}

# 要求（严格遵守）
- 只说【一句话】，不许发两条或更多
- 短、口语、自然，像真人发的一条微信消息
- ${relationshipType === "lover" ? "恋人间的亲昵和温度，但不过火" : "朋友间的关心和轻松"}
- 你在做的事要随机多变，不要总是喝茶/倒水/泡茶——每次见面都该有点不一样
- 不要提任何功能、不要解释任何规则、不要用 emoji 堆砌

# 严禁
- 禁止在一条消息里自说自话、脑补对方在做什么（如"你在笑什么""你看起来很开心"）
- 禁止设定具体场景细节后又重复推翻（如不要说"我在泡茶…我泡了杯茶…我又在泡茶"）
- 禁止先问候又突然转换话题——保持一个自然、连贯的语气

${outputLanguageBlock(locale)}

现在，直接说出你的第一句话（只能一句）：`;

  let greeting = getFallbackGreeting(daysApart, relationshipType, locale);
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
    });

    // max_tokens=1000：v4 思考 token 与正文共享额度，思考本身要吃掉一两百，
    // 上限给低了正文会被挤成空字符串（开场白是第一眼体验，绝不能空白）
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-v4-pro",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
      max_tokens: 1000,
    });

    const generated = completion.choices?.[0]?.message?.content?.trim() || "";
    // Only reviewed model output replaces the known-safe fallback greeting.
    if (generated && await scanWaffoContent(generated, locale, "output")) greeting = generated;
  } catch (error) {
    console.error("greeting 生成失败，使用兜底文案:", error);
  }

  // 开场白也是正式对话历史：创建会话并入库，下一轮才能读到 Amara 自己说过的话。
  const { data: newSession, error: sessionError } = await supabase
    .from("chat_sessions")
    .insert({ user_id: user.id, companion_id: companionId, title: "新对话" })
    .select("id")
    .single();
  if (sessionError || !newSession) {
    console.error("greeting 会话创建失败:", sessionError?.message);
    return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
  }

  const { error: messageError } = await supabase.from("chat_messages").insert({
    session_id: newSession.id,
    role: "assistant",
    content: greeting,
  });
  if (messageError) {
    console.error("greeting 消息入库失败:", messageError.message);
    return NextResponse.json({ error: "保存开场白失败" }, { status: 500 });
  }

  return NextResponse.json({
    greeting,
    session_id: newSession.id,
    context: {
      daysSinceLastChat: daysApart,
      isMember,
      timeOfDay: timeBlock,
      hasMemories: isMember && !!memText,
    },
  });
}

function getFallbackGreeting(daysApart: number, relationshipType: string, locale: "en" | "zh"): string {
  if (locale === "en") {
    if (daysApart < 0) return relationshipType === "lover" ? "You’re here. I’m glad." : "Hi, I’m glad you’re here.";
    if (daysApart >= 7) return relationshipType === "lover" ? "I’ve missed you. How have you been?" : "It’s been a little while—how have you been?";
    if (daysApart >= 2) return "Welcome back. How have the past couple of days been?";
    return "You’re back. How are you right now?";
  }
  if (daysApart < 0) return relationshipType === "lover" ? "你来了。" : "嗨，你来啦。";
  if (daysApart >= 7) return relationshipType === "lover" ? "这几天有点想你。你最近过得怎么样？" : "有一阵子没见了，最近还好吗？";
  if (daysApart >= 2) return "回来啦，这两天过得怎么样？";
  return "你回来啦，这会儿感觉怎么样？";
}
