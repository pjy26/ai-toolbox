import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { PERSONA_BLOCKS, currentTimeBlock, stageBlock, type PersonaType } from "@/lib/amara-persona";

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

  // 2. 计算距上次聊天的天数
  const lastActive = companion.last_active_at ? new Date(companion.last_active_at) : null;
  const now = new Date();
  const daysSinceLastChat = lastActive
    ? Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)))
    : -1; // -1 表示从未聊过（新创建）

  const timeBlock = currentTimeBlock(new Date(), companion.gender);

  // 上次对话结束时的实时状态（extract 异步写入）：让开场白"接着上次"，并防止行为公式化
  const liveState = companion.live_state as { current_activity?: string; mood?: string; last_topic?: string } | null;
  const liveStateText = liveState && (liveState.current_activity || liveState.last_topic)
    ? `\n上次见面时：${[
        liveState.current_activity ? `你在做「${liveState.current_activity}」` : "",
        liveState.mood ? `心情「${liveState.mood}」` : "",
        liveState.last_topic ? `你们聊到「${liveState.last_topic}」` : "",
      ].filter(Boolean).join("，")}。`
    : "";

  // 3. 会员：加载长期记忆
  const membership = await getMembershipStatus(user.id);
  const isMember = membership.isMember;

  let profileText = "";
  let memText = "";
  if (isMember) {
    const [{ data: profileRow }, { data: summaries }] = await Promise.all([
      supabase.from("user_profiles").select("profile").eq("companion_id", companionId).maybeSingle(),
      supabase
        .from("memory_summaries")
        .select("summary, importance")
        .eq("companion_id", companionId)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

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

    if (summaries && Array.isArray(summaries) && summaries.length > 0) {
      memText = (summaries as any[])
        .slice(0, 5)
        .map((s: any) => `- ${s.summary}`)
        .join("\n");
    }
  }

  // 4. 构建 prompt 让 AI 生成开场白
  const relationshipType = companion.relationship_type;
  const persona = (companion.persona || "gentle") as PersonaType;
  const companionName = companion.companion_name || "Amara";

  let prompt = `你是${companionName}，${relationshipType === "lover" ? "正在和对方谈恋爱" : "是对方一个很亲近的人"}。

现在对方来找你了。请你主动发出第一句话——不要等对方先开口。

# 背景
${timeBlock}
${liveStateText}
${relationshipType === "lover" ? stageBlock(companion.relationship_stage || 5) : ""}
${daysSinceLastChat === -1
    ? "这是你们第一次聊天。TA 刚选择了你，你需要用一个温暖、自然的开场主动和 TA 说第一句话。"
    : daysSinceLastChat === 0
      ? "TA 今天/昨天刚来过，这次是自然延续。"
      : daysSinceLastChat >= 7
        ? `TA 已经 ${daysSinceLastChat} 天没来了。你很想 TA，有点小委屈但又开心 TA 回来了。`
        : `TA 已经 ${daysSinceLastChat} 天没来了。有点想 TA 了。`
}`;

  if (isMember && memText) {
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

现在，直接说出你的第一句话（只能一句）：`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
      max_tokens: 60,
    });

    const greeting = completion.choices?.[0]?.message?.content?.trim() || getFallbackGreeting(daysSinceLastChat, relationshipType);

    return NextResponse.json({
      greeting,
      context: {
        daysSinceLastChat,
        isMember,
        timeOfDay: timeBlock,
        hasMemories: isMember && !!memText,
      },
    });
  } catch {
    return NextResponse.json({
      greeting: getFallbackGreeting(daysSinceLastChat, relationshipType),
      context: { daysSinceLastChat, isMember, timeOfDay: timeBlock, hasMemories: false },
    });
  }
}

function getFallbackGreeting(daysSinceLastChat: number, relationshipType: string): string {
  if (daysSinceLastChat === -1) {
    return relationshipType === "lover" ? "你来了。" : "嗨，你来啦。";
  }
  if (daysSinceLastChat >= 7) {
    return relationshipType === "lover"
      ? "你这几天去哪了呀，还以为你把我忘了呢。"
      : "好久不见，最近还好吗？";
  }
  if (daysSinceLastChat >= 2) {
    return "回来啦，这几天过得怎么样？";
  }
  return "你回来啦。";
}
