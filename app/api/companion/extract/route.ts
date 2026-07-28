import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { embedText } from "@/lib/embedding";

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
  const { companion_id, session_id } = await req.json();
  if (!companion_id) return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });

  // 校验归属
  const { data: companion } = await supabase
    .from("companions")
    .select("id, relationship_type")
    .eq("id", companion_id)
    .eq("user_id", user.id)
    .single();
  if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });

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

  // 取最近 5 条 summaries，避免重复
  const { data: existing } = await supabase
    .from("memory_summaries")
    .select("summary")
    .eq("companion_id", companion_id)
    .order("updated_at", { ascending: false })
    .limit(5);
  const existingSummaries = (existing || []).map((s: any) => s.summary).join("\n") || "(无)";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  });

  const extractPrompt = `你是一个记忆抽取器。下面是用户与AI陪伴角色的最近一段对话。请从中抽取值得长期记住的事实和情绪节点，以 JSON 返回。

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
    { "summary": "一句话", "importance": 3 }
  ],
  "emotion_state": {
    "valence": 0.5,
    "arousal": 0.5,
    "tags": ["开心"]
  },
  "new_events": [
    { "description": "一句话描述共同经历", "event_type": "milestone", "importance": 4 }
  ],
  "amara_state": {
    "current_activity": "对话结尾时陪伴角色正在做的事（具体、生活化，5-15字，如'窝在沙发追剧''刚跑完步喝水'）",
    "last_topic": "你们最后在聊的话题（5-15字）"
  }
}

规则：
- profile_updates 只包含这次对话里"新发现"或"需要更新"的字段，没有就留空对象/空数组。已有的档案字段不重复。
- ongoing_matters 是【覆盖式】字段：输出"截至此刻仍在进行的事"的完整列表。已经结束、解决、翻篇的事（如已改完的 bug、已结束的考试）不要再包含进去——它会整体替换旧列表。
- new_summaries 只写"值得长期带着"的事件/情绪节点，1-3 句，importance 1-5。没有就空数组。
- emotion_state 必填：以陪伴角色视角，对话结束那一刻的情绪。valence 愉悦度 -1（很难受）~1（很开心），arousal 激动程度 0（平静）~1（强烈），tags 1-4 个情绪词（如"开心""想念""小委屈""安心"）。
- new_events：判断这轮有没有"值得记的共同经历"，判定标准五类：①第一次类里程碑（第一次说喜欢、第一次互道晚安等）②吵架与和好 ③共同完成的事 ④生病或困难时的陪伴 ⑤对方表达深层情感的时刻。符合才写，不符合就空数组，宁缺毋滥。event_type 用 milestone/conflict_together/achievement/support/deep_feeling 之一。importance 1-5。
- amara_state 必填：以陪伴角色的视角描述对话结束那一刻的场景快照（只管"在干嘛/聊到哪"，情绪一律走 emotion_state，不要在这里表达情绪）。活动要具体、每次不同，不要总是"喝茶"。
- 一句话能讲清的别拆两条。
- 严格输出 JSON，不要 markdown 代码块，不要解释。`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-v4-pro",
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

    // 合并 profile（深合并，新值覆盖旧值，但数组按 unique 追加）
    if (parsed.profile_updates && Object.keys(parsed.profile_updates).length > 0) {
      const merged = JSON.parse(JSON.stringify(currentProfile));
      for (const key of Object.keys(parsed.profile_updates)) {
        const newVal = parsed.profile_updates[key];
        // ongoing_matters 覆盖式更新：模型输出的是"此刻仍在进行的事"全量列表，
        // 空数组也生效（表示手头的事都了结了），防止旧事（如已改完的 bug）永久残留
        if (key === "ongoing_matters" && Array.isArray(newVal)) {
          merged[key] = newVal;
          continue;
        }
        if (Array.isArray(newVal) && newVal.length > 0) {
          const oldArr = Array.isArray(merged[key]) ? merged[key] : [];
          const set = new Set<string>();
          for (const x of oldArr) set.add(typeof x === "string" ? x : JSON.stringify(x));
          for (const x of newVal) {
            const k = typeof x === "string" ? x : JSON.stringify(x);
            if (!set.has(k)) oldArr.push(x);
          }
          merged[key] = oldArr;
        } else if (typeof newVal === "object" && newVal !== null && !Array.isArray(newVal)) {
          merged[key] = { ...(merged[key] || {}), ...newVal };
        } else if (typeof newVal === "string" && newVal.trim()) {
          merged[key] = newVal;
        }
      }
      await supabase.from("user_profiles").upsert(
        { companion_id, profile: merged },
        { onConflict: "companion_id" }
      );
    }

    // 写入新 summaries（先 embedding 去重，> 0.9 视为重复跳过；embedding 复用去重时算的那个）
    if (Array.isArray(parsed.new_summaries) && parsed.new_summaries.length > 0) {
      const rows: any[] = [];
      for (const s of parsed.new_summaries) {
        if (!s?.summary || typeof s.summary !== "string") continue;
        const embedding = await embedText(s.summary, EMBED_TIMEOUT_MS);
        if (embedding) {
          const { data: maxSim } = await supabase.rpc("memory_max_similarity", {
            p_companion_id: companion_id,
            p_embedding: embedding,
          });
          if (typeof maxSim === "number" && maxSim > DEDUP_THRESHOLD) continue; // 重复，跳过
        }
        rows.push({
          companion_id,
          summary: s.summary,
          importance: Math.min(5, Math.max(1, Number(s.importance) || 1)),
          source_session_id: session_id || null,
          embedding: embedding || null,
        });
      }
      if (rows.length > 0) {
        await supabase.from("memory_summaries").insert(rows);
      }
    }

    // 写入共同经历（同 summaries：embedding 去重 > 0.9 跳过）
    if (Array.isArray(parsed.new_events) && parsed.new_events.length > 0) {
      const eventRows: any[] = [];
      for (const e of parsed.new_events) {
        if (!e?.description || typeof e.description !== "string") continue;
        const embedding = await embedText(e.description, EMBED_TIMEOUT_MS);
        if (embedding) {
          const { data: maxSim } = await supabase.rpc("event_max_similarity", {
            p_companion_id: companion_id,
            p_embedding: embedding,
          });
          if (typeof maxSim === "number" && maxSim > DEDUP_THRESHOLD) continue; // 重复，跳过
        }
        eventRows.push({
          companion_id,
          description: e.description,
          event_type: typeof e.event_type === "string" ? e.event_type : null,
          importance: Math.min(5, Math.max(1, Number(e.importance) || 3)),
          embedding: embedding || null,
        });
      }
      if (eventRows.length > 0) {
        await supabase.from("relationship_events").insert(eventRows);
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
      await supabase.from("companions").update({ emotion_state: emotionState }).eq("id", companion_id);
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
        await supabase.from("companions").update({ live_state: liveState }).eq("id", companion_id);
      }
    }

    return NextResponse.json({ ok: true, extracted: parsed });
  } catch (error: any) {
    console.error("extract error:", error);
    return NextResponse.json({ ok: false, error: error?.message }, { status: 503 });
  }
}
