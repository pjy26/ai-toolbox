import { NextResponse } from "next/server";
import { createCompanionClient, getCompanionModel } from "@/lib/companion-model";
import type { PersonaType } from "@/lib/amara-persona";

// 后台隐形性格匹配
// 触发条件：恋人版 companion、persona 未锁定（persona_locked_at is null）、
//          累计用户消息数 >= 6
// 用 LLM 看最近 8-12 条用户消息，从 4 个 persona 里选最匹配的一个，写死

const MATCH_THRESHOLD = 6; // 前 6 句用户消息后开始匹配

async function generatePersona(prompt: string): Promise<string> {
  const result = await createCompanionClient().chat.completions.create({
    model: getCompanionModel(),
    max_tokens: 1600,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  if (result.choices[0]?.finish_reason !== "stop") throw new Error("Incomplete persona response");
  return result.choices[0]?.message?.content || "";
}

export async function matchCompanionPersona(
  supabase: any, userId: string, companion_id: string,
  generate: (prompt: string) => Promise<string> = generatePersona,
) {
  // 1. 校验归属 + 拉取 companion 状态
  const { data: companion } = await supabase
    .from("companions")
    .select("id, user_id, relationship_type, persona, persona_locked_at")
    .eq("id", companion_id)
    .eq("user_id", userId)
    .single();

  if (!companion) return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  if (companion.relationship_type !== "lover") {
    return NextResponse.json({ ok: true, note: "friend_skip" });
  }
  if (companion.persona_locked_at) {
    return NextResponse.json({ ok: true, note: "already_locked", persona: companion.persona });
  }

  // 2. 数当前 companion 下的用户消息数
  //    先取该 companion 的所有 sessions
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("companion_id", companion_id);
  const sessionIds = (sessions || []).map((s: any) => s.id);
  if (sessionIds.length === 0) {
    return NextResponse.json({ ok: true, note: "no_messages" });
  }

  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("role", "user");

  if (!count || count < MATCH_THRESHOLD) {
    return NextResponse.json({ ok: true, note: "not_enough_messages", count });
  }

  // 3. 取最近 12 条用户消息做样本
  const { data: recentMsgs } = await supabase
    .from("chat_messages")
    .select("content, created_at")
    .in("session_id", sessionIds)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(12);

  const samples = (recentMsgs || [])
    .map((m: any) => m.content)
    .filter(Boolean)
    .reverse();

  if (samples.length < 3) {
    return NextResponse.json({ ok: true, note: "samples_too_short" });
  }

  // 4. LLM 判定 persona

  const judgePrompt = `你是一个性格匹配器。下面是用户在和恋人聊天的最近几条消息。请从下面 4 种恋人性格里，选出和这个用户最匹配的一个。

用户的最近消息（按时间顺序）：
${samples.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

4 种性格：
- gentle（温柔包容）：情绪稳定、会安抚人、让人放松。适合：情绪容易波动、需要被接住、话不多但想被理解的用户。
- playful（活泼俏皮）：爱笑爱逗、节奏轻快、闹中有暖。适合：爱开玩笑、爱闹、希望聊天气氛轻松有趣的用户。
- quiet（安静细腻）：话不多但句句在点、越相处越舒服。适合：话少、内敛、不喜欢聒噪、看重精准共情的用户。
- clingy（黏人撒娇）：热情主动、会黏人、给足存在感。适合：希望被强烈需要、喜欢被撒娇、需要被惦记感的用户。

判断维度：
- 话多 vs 话少
- 感性 vs 理性
- 希望被照顾 vs 希望照顾对方
- 是否需要被强烈回应 / 是否喜欢闹

只输出一个 JSON：{"persona": "gentle" | "playful" | "quiet" | "clingy", "reason": "一句话"}
不要 markdown、不要解释。`;

  try {
    const raw = await generate(judgePrompt);
    let parsed: { persona?: string; reason?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "parse_failed" }, { status: 500 });
    }

    const valid: PersonaType[] = ["gentle", "playful", "quiet", "clingy"];
    if (!parsed || !valid.includes(parsed.persona as PersonaType)) {
      return NextResponse.json({ ok: false, error: "invalid_persona" }, { status: 503 });
    }
    const matched = parsed.persona as PersonaType;

    // 5. 锁定 persona（写死，永不变）
    const { error: updErr } = await supabase
      .from("companions")
      .update({
        persona: matched,
        persona_locked_at: new Date().toISOString(),
      })
      .eq("id", companion_id)
      .is("persona_locked_at", null); // 并发安全：只有第一次能写

    if (updErr) {
      return NextResponse.json({ error: "Could not save persona" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      persona: matched,
      reason: parsed.reason,
      locked: true,
    });
  } catch (error: any) {
    console.error("[persona] match failed");
    return NextResponse.json({ ok: false, error: "Persona matching temporarily unavailable" }, { status: 503 });
  }
}
