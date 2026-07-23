import { getAuthUser, getMembershipStatus } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";

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
  "amara_state": {
    "current_activity": "对话结尾时陪伴角色正在做的事（具体、生活化，5-15字，如'窝在沙发追剧''刚跑完步喝水'）",
    "mood": "陪伴角色此刻的心情（2-6字，如'有点开心''小委屈''困困的'）",
    "last_topic": "你们最后在聊的话题（5-15字）"
  }
}

规则：
- profile_updates 只包含这次对话里"新发现"或"需要更新"的字段，没有就留空对象/空数组。已有的档案字段不重复。
- ongoing_matters 是【覆盖式】字段：输出"截至此刻仍在进行的事"的完整列表。已经结束、解决、翻篇的事（如已改完的 bug、已结束的考试）不要再包含进去——它会整体替换旧列表。
- new_summaries 只写"值得长期带着"的事件/情绪节点，1-3 句，importance 1-5。没有就空数组。
- amara_state 必填：以陪伴角色的视角描述对话结束那一刻的状态，用于下次对话的连续性。活动要具体、每次不同，不要总是"喝茶"。
- 一句话能讲清的别拆两条。
- 严格输出 JSON，不要 markdown 代码块，不要解释。`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-chat",
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

    // 写入新 summaries
    if (Array.isArray(parsed.new_summaries) && parsed.new_summaries.length > 0) {
      const rows = parsed.new_summaries
        .filter((s: any) => s?.summary && typeof s.summary === "string")
        .map((s: any) => ({
          companion_id,
          summary: s.summary,
          importance: Math.min(5, Math.max(1, Number(s.importance) || 1)),
          source_session_id: session_id || null,
        }));
      if (rows.length > 0) {
        await supabase.from("memory_summaries").insert(rows);
      }
    }

    // 写入实时状态：下次对话/开场白据此"接着上次"，并防止行为公式化
    if (parsed.amara_state && typeof parsed.amara_state === "object") {
      const s = parsed.amara_state;
      const liveState = {
        current_activity: typeof s.current_activity === "string" ? s.current_activity.slice(0, 50) : "",
        mood: typeof s.mood === "string" ? s.mood.slice(0, 20) : "",
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
