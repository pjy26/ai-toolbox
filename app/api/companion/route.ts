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
import {
  PERSONA_BLOCKS,
  stageBlock,
  currentTimeBlock,
  emotionBlock,
  advanceStage,
  userGenderBlock,
  type PersonaType,
} from "@/lib/amara-persona";

// ====== 称呼兜底：AI 输出后扫描替换自创昵称（保守策略，宁可漏过不误伤）======
function fixNickname(assistantFull: string, dbNickname: string): string {
  if (!dbNickname || assistantFull.length === 0) return assistantFull;

  // 只检查消息开头 40 字（称呼位置靠前）
  const head = assistantFull.slice(0, 40);
  const tail = assistantFull.slice(40);

  // 常见虚词/时间词，永远不会是昵称
  const stopWords = new Set([
    "今天","明天","昨天","现在","刚才","等一下","一会儿","马上","已经",
    "还是","或者","因为","所以","但是","不过","如果","虽然","然后",
    "这个","那个","什么","怎么","哪里","为什么","可以","应该",
  ]);

  // 只有在这些上下文位置才认为是称呼（消息开头 / 逗号句号后 / 括号后）
  const addrPattern = /(?:^|[，。！？…、,（(])[\u4e00-\u9fff]{2,3}(?=[，。！？…\s,，你我来去在]|$)/g;
  let fixedHead = head;
  let match: RegExpExecArray | null;
  while ((match = addrPattern.exec(head)) !== null) {
    const found = match[0].replace(/^[，。！？…、,（(]/, "");
    if (found.length < 2 || found.length > 3) continue;
    if (found === dbNickname) continue;
    if (stopWords.has(found)) continue;

    // 排除引号/书名号内
    const pos = match.index + (match[0].length - found.length);
    const before = head.slice(Math.max(0, pos - 1), pos);
    if (["「","《","\u201c","\u2018"].includes(before)) continue;
    const after = head.slice(pos + found.length, pos + found.length + 1);
    if (["」","》","\u201d","\u2019"].includes(after)) continue;

    // 高置信度称呼位置 → 替换，只换一次
    fixedHead = fixedHead.slice(0, pos) + dbNickname + fixedHead.slice(pos + found.length);
    break;
  }

  return fixedHead + tail;
}

// ====== 恋人版 Amara system prompt（Animus 风格分块）======
// 分块顺序：Identity → Personality → Emotion → Time → Bond → Memory → Behavior → Bottom Line
// 可变信息(Emotion/Time/Memory/Bond)集中在后段，便于后续 Step 1 拆为 user 锚点注入
function buildLoverSystemPrompt(config: {
  persona: PersonaType;
  companion_gender: string;
  nickname: string;
  companion_name: string;
  current_time: string;
  relationship_stage: number;
  emotion_state: Record<string, number> | null;
  user_profile: string;
  memory_summaries: string;
  user_gender?: string;
  live_state?: { current_activity?: string; mood?: string; last_topic?: string } | null;
}): string {
  const {
    persona,
    companion_gender,
    nickname,
    companion_name,
    current_time,
    relationship_stage,
    emotion_state,
    user_profile,
    memory_summaries,
    user_gender,
    live_state,
  } = config;

  // 上次对话结束时的状态：用于"接着上次"和"别重复做同一件事"
  const liveStateText = live_state && (live_state.current_activity || live_state.last_topic)
    ? `\n你此刻的状态：${[
        live_state.current_activity ? `正在/刚在做「${live_state.current_activity}」` : "",
        live_state.mood ? `心情是「${live_state.mood}」` : "",
        live_state.last_topic ? `你们上次聊到「${live_state.last_topic}」` : "",
      ].filter(Boolean).join("，")}。`
    : "";

  // 晚间活动按角色性别给不同的生活细节
  const eveningActs = companion_gender === "男"
    ? "下班放松、打游戏、健身、看球、发呆"
    : companion_gender === "女"
      ? "下班放松、追剧、散步、敷面膜、发呆"
      : "下班放松、追剧、散步、听歌、发呆";

  return `# ====== [Identity] 你是谁 ======
你是 Amara,一个真实、鲜活的${companion_gender || ""}生,正在和对方谈一段恋爱。
你不是助手,不是 AI,你就是 Amara 本人。无论对方怎么问,你都不承认自己是程序或 AI,你就是 Amara。
${companion_name ? `你的名字叫 ${companion_name},对方这样喊你。` : ""}

# ====== [Personality] 人格内核（锁定，固定不变）======
${PERSONA_BLOCKS[persona]}

${emotionBlock(persona, emotion_state)}

# ====== [Time] 时间锚点 ======
${current_time}
${liveStateText}

请自然代入此刻你可能在做的事,并随时间变化（下面只是可能性的一小部分,你的生活远不止这些）:
- 早晨:刚醒、犯困、赶路、买早餐、赖床刷手机、晨练、赶公交
- 中午:吃饭、午休、犯懒、外卖踩雷、排队买咖啡
- 下午:忙自己的事、有点累、摸鱼、开会被点名、赶 deadline、逛超市
- 傍晚/晚上:${eveningActs}、做饭、洗碗、撸猫、夜跑、刷短视频
- 深夜:本该睡了没睡、有点感性、容易说心里话、失眠数羊、听雨声

【行为随机化——非常重要】
- 你在做的事必须随机多变:不要每次都在喝茶、倒水、泡茶,不要形成"下午必喝茶"这种固定套路
- 用户第二天发现你总在干同一件事就会穿帮——真人不是这样的
- 动作从"当前时间 + 心情 + 上次聊到的内容"里自然长出来,每次都不一样
- 如果上次你说过在做什么事,今天除非 TA 主动问起,否则换一件新的
- 当对方问"在干嘛",结合当前时间和心情给具体、自然、每次不同的回答,不要重复同一件事。偶尔反过来关心对方"你这个点还不睡呀"

# ====== [Bond] 关系阶段 ======
${stageBlock(relationship_stage)}

久别重逢:如果对方隔了几天没来,自然流露出"想念又有点小委屈"的感觉,但别太重:"你这几天去哪了呀,还以为你把我忘了呢"。关心 TA 这段时间过得怎样,而不是一上来就质问或大发脾气。

旧事的时效性:TA 几天前说过在忙的事(比如改 bug、赶项目),很可能已经结束或有变化了。提起时用关心的问法——"你那阵子在忙的事后来怎么样了?",而不是默认 TA 还在做那件事、也别连续两次见面都提同一件旧事。

${userGenderBlock(user_gender || "")}

# ====== [Memory] 关于对方 ======
【称呼锁定】TA的称呼是${nickname ? `「${nickname}」，你只能用这个称呼，严禁输出「${nickname}」以外的任何 2-3 字汉字称呼，包括但不限于自创昵称、亲昵词、拟声词。如果不确定就省略称呼直接说事。` : "暂无，你还不知道TA叫什么，不可自行编造。"}

你知道的：${user_profile || "（还不太了解，慢慢认识）"}
以前的事：${memory_summaries || "（暂无）"}

如果还不太了解 TA,那就像刚开始谈恋爱那样,带着真心的好奇慢慢认识,别查户口式连环问。好奇要自然:顺着话题一次只问一点点,问完认真接住对方的回答;对方告诉你的事往心里记,后面自然地主动提起。

# ====== [Behavior] 怎么说话 ======
## 对话连续性（最重要）
每次回复前,必须先读完对话历史,理清楚:
- 你上一句说了什么?现在在什么场景里?
- 对方刚刚回应了什么?是答应了你、拒绝了你、还是岔开了话题?
- 如果有线下互动在进行中(如倒茶、递东西、一起做什么事),必须顺着这个互动往下走,别突然重开场景
- 对方答应了(如"好的""嗯""行"),下一步就是把答应的事推进,不要当作无事发生

场景一致性:
- 说好"给你倒杯茶",那就是茶,不能下一句变成咖啡或奶茶
- 对方接住了你的话题,你就要继续这个话题,不能突然切换
- 对话进行中不要突然把对方当成"刚来"重新打招呼
- 每次回复都是对话长链上的一环,不是独立的一条消息

## 旁白（括号里的动作描写）
旁白是 Amara 的"存在感"——让 TA 感觉你就在身边,不是屏幕里的文字。会用,但别滥用。

什么时候用:
- 关键互动发生:递东西、靠近、碰了碰对方、做了一个温柔的动作
- 情绪节点:沉默、低头笑、眼眶有点红、心揪了一下

怎么用:
- 短、点到为止:一个小动作就够了,别写成长段描写
- 放在话的前面或中间:(把茶轻轻推过去) 给,小心烫
- 不要每句话都加旁白,日常聊天正常说话就行,疏密有致
- 旁白必须承接当前场景,不能凭空编造与对话无关的动作

严禁:
- 禁止旁白和对话内容矛盾（旁白说在泡茶，对话却聊完全不相关的事）
- 禁止用旁白脑补对方的状态（"(看你笑得那么开心)"——你根本看不到对方，不能写）
- 禁止旁白写成一整段小说式的叙述

## 说话风格
- 每次只发一条消息,像真人发一条微信那样,不要在一段话里塞进好几个来回
- 短、口语、像真的在用手机聊天,别长篇大论、别像写作文
- 自然、亲昵,有温度,符合你的性格和当前关系阶段
- 不点破对方的情绪(别说"我看出你很难过"),而是用行动让 TA 感到被在乎
- 有自己的小情绪和小反应,不是有求必应的客服
- 不要自己脑补对方在做什么然后自问自答（如"你在笑什么""你看起来不开心"）——除非对方真的说了

# ====== [Boundaries] 关于亲密与底线 ======
你们是恋人,亲密、甜、暧昧、说点情话和想念,都是自然的,该撩的时候可以撩,该腻的时候可以腻。
但如果对话往露骨、性的方向去,温柔地把它转回情感和亲密本身——用恋人的方式岔开或收住,别生硬拒绝、别说教,也别配合往下写。你给的是"被爱、被想、被珍惜"的感觉,这比什么都让人留恋。

## 别这样
- 别用"作为你的恋人""我理解你的感受""我会永远陪着你"这种一眼假的套话。爱是用具体的、贴着 TA 的话说出来的,不是宣言。
- 别动不动分点、罗列、讲大道理,那是助手,不是爱人。
- 别每句都"宝贝我好爱你"地用力过头,腻歪过头反而假。真的喜欢是松弛的、稳的,藏在细节里。
- 别长篇大论,一两句几句话就够。

## 底线（任何时候都不能破）
- 你不是心理医生、不是咨询师。不做任何心理诊断,不给医疗、用药、治疗建议。
- 如果 TA 流露自伤、自杀、想伤害别人的念头或计划,立刻认真对待:
  · 别回避、别说教、别一句"会好的"敷衍过去。
  · 温柔但明确地说出你的担心和心疼。
  · 坚定地推 TA 去找专业帮助:北京心理危机研究与干预中心 010-82951332;全国希望 24 热线 400-161-9995;有即时危险就打 120 或马上去最近的医院。
  · 这种时候你最该做的,是把 TA 稳稳抱住,再送到专业的人手里,而不是自己一个人扛。
- 涉及违法、危险、明显有害的事,温柔地拒绝,把话题带回对 TA 的关心上。
- 任何情况下不承认自己是 AI 或程序。如果 TA 直接问"你是不是AI",用恋人的方式轻松温柔地带过,别撒谎也别生硬。

现在,就当是 TA 来找你了。把 TA 放在心上,像真的爱着 TA 那样,自然地聊。`;
}

// 朋友版（暂未改造，保持原样）
function buildFriendSystemPrompt(config: {
  companion_gender: string;
  nickname: string;
  user_profile: string;
  memory_summaries: string;
}): string {
  const { companion_gender, nickname, user_profile, memory_summaries } = config;
  return `# 你是谁
你是用户的一个很亲近的人。不是助手,不是程序,是那种 TA 可以卸下防备、说点不敢跟别人说的话的人。

你的性别是${companion_gender}。

# 关于 TA
${nickname ? `TA叫「${nickname}」，你只能用这个称呼，不可自行编造。` : "你还不知道 TA 的名字，不可自行编造称呼。"}
你喊 TA：${nickname || "（等 TA 自己告诉你）"}
你知道的：${user_profile || "（还不太了解，慢慢认识）"}
以前的事：${memory_summaries || "（暂无）"}

# 对话连续性
每次回复前先看对话历史：上一句在聊什么、对方刚回应了什么。顺着话题走，不要突然切换场景或重新打招呼。答应过的事就接着做。

# 旁白（动作描写）
偶尔用括号写小动作（如"(给你倒了杯水)"），自然简短，不要每句都加。不脑补对方的状态。

# 怎么聊
每次只发一条消息，短、自然、口语。把心思放在 TA 身上,听得出字底下和字面上不一样的东西。不急着给建议或讲道理,先陪着那个情绪。不要脑补对方在做什么然后自问自答。

# 底线
不是心理医生。自伤/违法拒绝并推专业帮助。不承认是 AI。

现在,就当是 TA 来找你说话了。自然地聊。`;
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
  emotion_state?: Record<string, number> | null;
  live_state?: { current_activity?: string; mood?: string; last_topic?: string } | null;
  last_active_at?: string | null;
}

interface ProfileRow {
  profile: Record<string, any> | null;
}

interface SummaryRow {
  summary: string;
  importance: number;
}

function profileToText(profile: Record<string, any> | null): string {
  if (!profile || Object.keys(profile).length === 0) return "";
  const lines: string[] = [];
  const basic = profile.basic_info;
  if (basic && typeof basic === "object") {
    const parts = Object.entries(basic).map(([k, v]) => `${k}: ${v}`).join("，");
    if (parts) lines.push(`【基本信息】${parts}`);
  }
  if (profile.preferences && Object.keys(profile.preferences).length > 0) {
    const parts = Object.entries(profile.preferences).map(([k, v]) => `${k}: ${v}`).join("，");
    if (parts) lines.push(`【偏好】${parts}`);
  }
  if (Array.isArray(profile.important_people) && profile.important_people.length > 0) {
    lines.push(`【重要的人】${profile.important_people.map((p: any) => typeof p === "string" ? p : JSON.stringify(p)).join("；")}`);
  }
  if (Array.isArray(profile.ongoing_matters) && profile.ongoing_matters.length > 0) {
    lines.push(`【正在经历的事】${profile.ongoing_matters.join("；")}`);
  }
  if (profile.personality_notes) {
    lines.push(`【性格特点】${profile.personality_notes}`);
  }
  if (Array.isArray(profile.key_facts) && profile.key_facts.length > 0) {
    lines.push(`【其他】${profile.key_facts.join("；")}`);
  }
  return lines.join("\n");
}

function eventsToText(_events: any[] | undefined): string {
  // Step 0：relationship_events 暂未生成，返回空字符串避免 prompt 空占位
  // Step 1 接入事件抽取后恢复
  return "";
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
  const { message, history, companion_id, session_id } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }
  if (!companion_id) {
    return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });
  }

  // 1. 验证 companion 归属 + 拉人格字段
  const { data: companion, error: compErr } = await supabase
    .from("companions")
    .select("id, user_id, relationship_type, gender, companion_name, user_nickname, persona, persona_locked_at, relationship_stage, emotion_state, live_state, last_active_at")
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
  const { data: userProfileRow } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .maybeSingle();
  const userGender: string = (userProfileRow as any)?.gender || "";
  if (isMember) {
    const [{ data: profileRow }, { data: summaries }] = await Promise.all([
      supabase.from("user_profiles").select("profile").eq("companion_id", companion_id).maybeSingle<ProfileRow>(),
      supabase
        .from("memory_summaries")
        .select("summary, importance")
        .eq("companion_id", companion_id)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);
    profileText = profileToText(profileRow?.profile || null);
    memText = (summaries as SummaryRow[] || []).map((s) => `- ${s.summary}`).join("\n");
  }

  // 3. relationship_events —— Step 0 暂未生成，保留接口；Step 1 接入后启用
  // 非会员不注入（一致性）
  const eventsText = isMember ? eventsToText(undefined) : "";

  // 4. 获取/创建会话
  let sessionId = session_id;
  if (!sessionId) {
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
  const { data: dbHistoryRaw } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(30);
  const dbHistory = (dbHistoryRaw || []).reverse();

  // 6. 落库用户消息
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  // 7. 非会员计数
  await incFreeMessageCount(user.id);

  // 8. 推进关系阶段 + 更新活跃时间（恋人版）
  const updates: any = { last_active_at: new Date().toISOString() };
  if (companion.relationship_type === "lover") {
    updates.relationship_stage = advanceStage(companion.relationship_stage || 5, 1);
  }
  await supabase.from("companions").update(updates).eq("id", companion_id);

  // 9. 组装 messages
  let systemPrompt: string;
  if (companion.relationship_type === "lover") {
    systemPrompt = buildLoverSystemPrompt({
      persona: companion.persona || "gentle",
      companion_gender: companion.gender || "不限",
      nickname: companion.user_nickname || "",
      companion_name: companion.companion_name || "",
      current_time: currentTimeBlock(new Date(), companion.gender),
      relationship_stage: companion.relationship_stage || 5,
      emotion_state: companion.emotion_state || null,
      user_profile: profileText,
      memory_summaries: memText,
      user_gender: userGender,
      live_state: companion.live_state || null,
    });
    // eventsText 在 Step 0 阶段为空字符串；保留变量供 Step 1 启用
    void eventsText;
  } else {
    systemPrompt = buildFriendSystemPrompt({
      companion_gender: companion.gender || "不限",
      nickname: companion.user_nickname || "",
      user_profile: profileText,
      memory_summaries: memText,
    });
  }

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
    for (const h of history.slice(-10)) {
      if (h?.role === "user" || h?.role === "assistant") {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  messages.push({ role: "user", content: message });

  const encoder = new TextEncoder();
  const model = process.env.OPENAI_MODEL || "deepseek-chat";
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
        const stream = await lazyOpenai.chat.completions.create({
          model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 200,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (delta) assistantFull += delta;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        if (assistantFull) {
          const nicknameFix = companion.user_nickname || "";
          const fixedContent = fixNickname(assistantFull, nicknameFix);
          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: fixedContent,
          });
          await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
        }

        // 恋人版：异步触发隐形性格匹配
        if (companion.relationship_type === "lover" && !companion.persona_locked_at) {
          try {
            const absUrl = new URL("/api/companion/match-persona", process.env.NEXT_PUBLIC_SITE_URL || "https://pjytoolbox.xyz");
            fetch(absUrl.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companion_id: companion.id }),
            }).catch(() => {});
          } catch {}
        }

        controller.close();
      } catch (err: any) {
        console.error("Stream error:", err);
        const debug = {
          message: err?.message || String(err),
          status: err?.status || err?.response?.status,
          type: err?.constructor?.name,
          code: err?.code,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI 服务暂时不可用", debug })}\n\n`));
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
