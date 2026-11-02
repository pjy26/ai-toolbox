import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createCompanionClient, getCompanionModel } from "@/lib/companion-model";
import { embedText } from "@/lib/embedding";
import { isMemoryEnabled } from "@/lib/user-settings";
import {
  dedupeMemoryEntries,
  findMemoryTextMatch,
  isExpiredTransientMemory,
  isUserScopedMemoryText,
  mergeMemoryArrays,
} from "@/lib/memory-reliability";

// 语义去重阈值：cosine 相似度 > 0.9 视为重复，跳过写入（初始值，可调）
const DEDUP_THRESHOLD = 0.9;
// extract 是异步后台链路，embedding 超时放宽到 5 秒
const EMBED_TIMEOUT_MS = 5000;

// 从最近对话中抽取记忆要点（更新 profile + 写入 memory_summaries）
// 仅会员可调用：长期记忆是会员特权
// 调用时机：前端在每轮对话结束后异步触发，不阻塞用户

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 会员校验
  const status = await getMembershipStatus(user.id);
  if (!status.isMember) {
    return NextResponse.json({ error: "需要会员", code: "MEMBER_ONLY" }, { status: 403 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { companion_id, session_id, locale: requestedLocale } = await req.json();
  const locale = requestedLocale === "zh" ? "zh" : "en";
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  // 校验归属
  const { data: companion } = await supabase
    .from("companions")
    .select("id, relationship_type, companion_name, user_nickname")
    .eq("id", companion_id)
    .eq("user_id", user.id)
    .single();
  if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  if (!(await isMemoryEnabled(supabase, user.id))) {
    return NextResponse.json({ ok: true, note: "memory_disabled" });
  }

  // 会话必须同时属于当前用户和当前角色，避免把一个角色的对话抽取进另一个角色。
  if (session_id) {
    const { data: ownedSession, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("companion_id", companion_id)
      .maybeSingle();
    if (sessionError || !ownedSession) {
      console.error("extract 会话归属校验失败:", sessionError?.message);
      return NextResponse.json({ error: "会话不存在或与角色不匹配" }, { status: 404 });
    }
  }

  // 取最近 12 条消息作为抽取上下文
  let query = supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (session_id) query = query.eq("session_id", session_id);
  else {
    // 没传 session_id，则取该 companion 的所有最近消息
    const { data: sessions } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("companion_id", companion_id)
      .order("updated_at", { ascending: false })
      .limit(3);
    const ids = (sessions || []).map((s: any) => s.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, note: "no_messages" });
    query = query.in("session_id", ids);
  }
  const { data: recent } = await query;
  if (!recent || recent.length === 0) {
    return NextResponse.json({ ok: true, note: "no_messages" });
  }
  const recentText = (recent as any[]).reverse().map((m) => `${m.role}: ${m.content}`).join("\n");

  // 取当前 profile
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("profile")
    .eq("companion_id", companion_id)
    .maybeSingle();
  const currentProfile = profileRow?.profile || {};

  // 本地文本去重要覆盖比提示词更多的历史；embedding 不可用时仍能可靠去重。
  const { data: existing, error: existingError } = await supabase
    .from("memory_summaries")
    .select("id, summary, importance, source_session_id, created_at, updated_at")
    .eq("companion_id", companion_id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (existingError) {
    return NextResponse.json({ ok: false, error: "读取已有记忆失败" }, { status: 503 });
  }
  const existingMemories = ((existing || []) as any[])
    .filter((memory) => isUserScopedMemoryText(memory.summary));
  const existingSummaries = dedupeMemoryEntries(
    existingMemories,
    (memory) => memory.summary,
    (memory) => isExpiredTransientMemory(memory.summary, memory.updated_at || memory.created_at),
  ).slice(0, 5).map((memory) => memory.summary).join("\n") || "(无)";

  const openai = createCompanionClient();

  const extractPrompt = `你是一个保守的记忆抽取器。下面是 user 与 assistant（Amara）的最近对话。请把“长期事实”“共同经历”“近期状态”分开抽取，以严格 JSON 返回。

当前已有的用户档案：
${JSON.stringify(currentProfile)}

已有的记忆摘要（避免重复）：
${existingSummaries}

最近对话：
${recentText}

请输出严格的 JSON，结构如下：
{
  "profile_updates": {
    "basic_info": {},
    "preferences": {},
    "important_people": [],
    "ongoing_matters": [],
    "personality_notes": "",
    "key_facts": []
  },
  "new_summaries": [
    { "summary": "一个原子事实，一句话", "importance": 3 }
  ],
  "emotion_state": {
    "valence": 0.5,
    "arousal": 0.5,
    "tags": ["开心"]
  },
  "new_events": [
    { "description": "一句可以直接展示给用户的 Amara 第一人称独白", "event_type": "milestone", "importance": 4 }
  ],
  "amara_state": {
    "current_activity": "对话结尾时 Amara 正在做的事",
    "last_topic": "最后聊到的具体话题"
  }
}

规则：
- 【输出语言】所有新增自然语言内容必须使用${locale === "zh" ? "自然、简洁的简体中文" : "natural, concise English"}，包括档案值、摘要、事件、情绪标签和状态；JSON 字段名保持不变。
- 【事实来源】profile_updates 和 new_summaries 只能来自 user 明确陈述的信息。assistant 的猜测、安慰、比喻、角色扮演、虚构细节和未经 user 确认的反问，一律不得写成用户事实。无法确认就不抽取。
- 【档案与摘要分工】profile_updates 保存稳定的基本信息、偏好、习惯、重要人物和仍在进行的事；new_summaries 只补充值得长期携带且尚未进入档案的原子事实。一条只写一个用户事实，不写双方互动，不写 assistant 的行为、感受、猜测或判断，不用空泛标签。
- 【About You 边界】profile_updates 和 new_summaries 中禁止出现“陪伴角色”“陪伴体”“assistant”“Amara”或 companion。像“用户对陪伴角色说……”属于互动，只能在符合 new_events 标准时进入 new_events；像“assistant 觉得用户……”属于 assistant 的推测，必须彻底丢弃。
- 【纠正不是新事实】用户纠正旧记忆时，只输出纠正后的用户事实本身；不要把“用户纠正了某条记忆”写成新摘要。
- 【摘要视角】new_summaries 直接写用户事实，通常省略“用户”这个第三方标签，例如写“今天需要休息”，不要写“用户今天需要休息”。
- important_people 优先使用对象，如 {"name":"名字","relation":"关系","notes":"用户明确说过的细节"}；不知道名字时不要编造。
- profile_updates 只包含这次对话里新发现或需要更新的字段，没有就留空对象/空数组；已有内容不重复。
- ongoing_matters 是【覆盖式】字段：输出截至此刻仍在进行的事的完整列表。已经结束、解决、翻篇的事不要再包含。
- new_events 只能记录对话中实际发生的双方互动，不得把 assistant 单方面设想的场景写成共同经历。判定标准五类：①第一次类里程碑②吵架与和好③共同完成的事④困难时的陪伴⑤对方表达深层情感的时刻。符合才写，不符合就空数组，宁缺毋滥。event_type 用 milestone/conflict_together/achievement/support/deep_feeling 之一，importance 1-5。
- 【独白格式】new_events.description 必须以 Amara 的“我 / I”为主体，用一两句具体的话写下实际互动，可直接放进“Our Moments”。用户称为“${companion.user_nickname || (locale === "zh" ? "你" : "you")}”。禁止出现“用户”“这位用户”“陪伴角色”“assistant”“TA”“Amara 记得”等第三方标签；禁止再添加“我记得”“那天有一件小事”等万能开头。不得虚构 Amara 没有表达过的感受或反应。
- emotion_state 必填：以 Amara 视角记录对话结束时的情绪。valence -1~1，arousal 0~1，tags 1-4 个。
- amara_state 必填：只描述对话结束时的场景快照和最后话题，不写情绪，不把它当长期事实；活动具体且自然，不默认喝茶。
- 不得综合多条记忆或推测折中事实。新信息与已有信息冲突时，只输出用户最新明确陈述的内容，由系统保守处理。
- 严格输出 JSON，不要 markdown 代码块，不要解释。`;

  try {
    const completion = await openai.chat.completions.create({
      model: getCompanionModel(),
      messages: [{ role: "user", content: extractPrompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "parse_failed", raw }, { status: 500 });
    }

    // 合并 profile：对象新值覆盖旧值；字符串数组也执行完全/近似去重和冲突保守跳过。
    if (parsed.profile_updates && Object.keys(parsed.profile_updates).length > 0) {
      const merged = JSON.parse(JSON.stringify(currentProfile));
      for (const key of Object.keys(parsed.profile_updates)) {
        const newVal = parsed.profile_updates[key];
        // ongoing_matters 覆盖式更新：空数组同样生效，防止已结束事项永久残留。
        if (Array.isArray(newVal)) {
          merged[key] = mergeMemoryArrays(merged[key], newVal, key === "ongoing_matters");
        } else if (typeof newVal === "object" && newVal !== null && !Array.isArray(newVal)) {
          merged[key] = { ...(merged[key] || {}), ...newVal };
        } else if (typeof newVal === "string" && newVal.trim()) {
          merged[key] = newVal;
        }
      }
      const { error: profileWriteError } = await supabase.from("user_profiles").upsert(
        { companion_id, profile: merged },
        { onConflict: "companion_id" }
      );
      if (profileWriteError) throw new Error(`用户档案写入失败: ${profileWriteError.message}`);
    }

    const memoryWriteStats = {
      summariesInserted: 0,
      summariesRefreshed: 0,
      summaryDuplicatesSkipped: 0,
      summaryConflictsSkipped: 0,
      nonUserSummariesSkipped: 0,
      eventsInserted: 0,
      eventDuplicatesSkipped: 0,
      eventConflictsSkipped: 0,
    };

    // 先做本地完全/近似/冲突判断，再用 embedding 补充语义去重。
    // 过期的临时事实若被用户再次明确提及，则更新原行，保留来源并刷新时间，不再新增一行。
    if (Array.isArray(parsed.new_summaries) && parsed.new_summaries.length > 0) {
      const rows: any[] = [];
      const workingMemories = existingMemories.map((memory) => ({ ...memory }));
      const extractedAt = new Date().toISOString();
      for (const s of parsed.new_summaries) {
        if (typeof s?.summary !== "string" || !s.summary.trim()) continue;
        const summary = s.summary.trim().slice(0, 4000);
        if (!isUserScopedMemoryText(summary)) {
          memoryWriteStats.nonUserSummariesSkipped += 1;
          continue;
        }
        const importance = Math.min(5, Math.max(1, Number(s.importance) || 1));
        const matchInfo = findMemoryTextMatch(summary, workingMemories.map((memory) => memory.summary));
        if (matchInfo?.relation === "conflict") {
          memoryWriteStats.summaryConflictsSkipped += 1;
          continue;
        }
        if (matchInfo) {
          const matched = workingMemories[matchInfo.index];
          const wasExpired = isExpiredTransientMemory(
            matched.summary,
            matched.updated_at || matched.created_at,
            new Date(extractedAt),
          );
          if (!matched.id || !wasExpired) {
            memoryWriteStats.summaryDuplicatesSkipped += 1;
            continue;
          }
          const embedding = await embedText(summary, EMBED_TIMEOUT_MS);
          const refreshed = {
            summary,
            importance: Math.max(Number(matched.importance) || 1, importance),
            source_session_id: session_id || matched.source_session_id || null,
            // 新正文不能继续沿用旧向量；服务暂不可用时由后续语义路径安全降级。
            embedding: embedding || null,
          };
          const { error: refreshError } = await supabase
            .from("memory_summaries")
            .update(refreshed)
            .eq("id", matched.id)
            .eq("companion_id", companion_id);
          if (refreshError) throw new Error(`过期记忆更新失败: ${refreshError.message}`);
          Object.assign(matched, refreshed, { updated_at: extractedAt });
          memoryWriteStats.summariesRefreshed += 1;
          continue;
        }

        const embedding = await embedText(summary, EMBED_TIMEOUT_MS);
        if (embedding) {
          const { data: maxSim } = await supabase.rpc("memory_max_similarity", {
            p_companion_id: companion_id,
            p_embedding: embedding,
          });
          const similarity = Number(maxSim);
          if (Number.isFinite(similarity) && similarity > DEDUP_THRESHOLD) {
            memoryWriteStats.summaryDuplicatesSkipped += 1;
            continue;
          }
        }
        const row = {
          companion_id,
          summary,
          importance,
          source_session_id: session_id || null,
          embedding: embedding || null,
        };
        rows.push(row);
        workingMemories.push({ ...row, id: null, created_at: extractedAt, updated_at: extractedAt });
      }
      if (rows.length > 0) {
        const { error: summaryWriteError } = await supabase.from("memory_summaries").insert(rows);
        if (summaryWriteError) throw new Error(`记忆摘要写入失败: ${summaryWriteError.message}`);
        memoryWriteStats.summariesInserted = rows.length;
      }
    }

    // 共同经历也做全量近期文本与批内去重，不再完全依赖 embedding 服务。
    if (Array.isArray(parsed.new_events) && parsed.new_events.length > 0) {
      const { data: existingEvents, error: existingEventsError } = await supabase
        .from("relationship_events")
        .select("id, description")
        .eq("companion_id", companion_id)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (existingEventsError) throw new Error(`读取已有共同经历失败: ${existingEventsError.message}`);
      const workingEventTexts = (existingEvents || []).map((event: any) => event.description);
      const eventRows: any[] = [];
      for (const e of parsed.new_events) {
        if (typeof e?.description !== "string" || !e.description.trim()) continue;
        const description = e.description.trim().slice(0, 4000);
        const matchInfo = findMemoryTextMatch(description, workingEventTexts);
        if (matchInfo?.relation === "conflict") {
          memoryWriteStats.eventConflictsSkipped += 1;
          continue;
        }
        if (matchInfo) {
          memoryWriteStats.eventDuplicatesSkipped += 1;
          continue;
        }
        const embedding = await embedText(description, EMBED_TIMEOUT_MS);
        if (embedding) {
          const { data: maxSim } = await supabase.rpc("event_max_similarity", {
            p_companion_id: companion_id,
            p_embedding: embedding,
          });
          const similarity = Number(maxSim);
          if (Number.isFinite(similarity) && similarity > DEDUP_THRESHOLD) {
            memoryWriteStats.eventDuplicatesSkipped += 1;
            continue;
          }
        }
        eventRows.push({
          companion_id,
          description,
          event_type: typeof e.event_type === "string" ? e.event_type : null,
          importance: Math.min(5, Math.max(1, Number(e.importance) || 3)),
          embedding: embedding || null,
        });
        workingEventTexts.push(description);
      }
      if (eventRows.length > 0) {
        const { error: eventWriteError } = await supabase.from("relationship_events").insert(eventRows);
        if (eventWriteError) throw new Error(`共同经历写入失败: ${eventWriteError.message}`);
        memoryWriteStats.eventsInserted = eventRows.length;
      }
    }

    // 写入情绪状态（情绪一律走 emotion_state，live_state 只留场景快照）
    if (parsed.emotion_state && typeof parsed.emotion_state === "object") {
      const es = parsed.emotion_state;
      const clamp = (v: any, min: number, max: number, dflt: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
      };
      const emotionState = {
        valence: clamp(es.valence, -1, 1, 0),
        arousal: clamp(es.arousal, 0, 1, 0.5),
        tags: Array.isArray(es.tags)
          ? es.tags.filter((t: any) => typeof t === "string" && t.trim()).slice(0, 4)
          : [],
        updated_at: new Date().toISOString(),
      };
      const { error: emotionWriteError } = await supabase
        .from("companions")
        .update({ emotion_state: emotionState })
        .eq("id", companion_id);
      if (emotionWriteError) throw new Error(`情绪状态写入失败: ${emotionWriteError.message}`);
    }

    // 写入实时状态：下次对话/开场白据此"接着上次"，并防止行为公式化
    // 注意：mood 已从 live_state 移除（弱化语义，情绪统一走 emotion_state）
    if (parsed.amara_state && typeof parsed.amara_state === "object") {
      const s = parsed.amara_state;
      const liveState = {
        current_activity: typeof s.current_activity === "string" ? s.current_activity.slice(0, 50) : "",
        mood: "",
        last_topic: typeof s.last_topic === "string" ? s.last_topic.slice(0, 50) : "",
        updated_at: new Date().toISOString(),
      };
      if (liveState.current_activity || liveState.last_topic) {
        const { error: liveStateWriteError } = await supabase
          .from("companions")
          .update({ live_state: liveState })
          .eq("id", companion_id);
        if (liveStateWriteError) throw new Error(`实时状态写入失败: ${liveStateWriteError.message}`);
      }
    }

    return NextResponse.json({ ok: true, extracted: parsed, memory_write_stats: memoryWriteStats });
  } catch (error: any) {
    console.error("extract error:", error);
    return NextResponse.json({ ok: false, error: error?.message }, { status: 503 });
  }
}
