import { createServerAdminClient } from "./supabase";
import { createCompanionClient, getCompanionModel } from "./companion-model";
import { withGenerationGuard } from "./generation-guard";
import { embedText } from "./embedding";
import {
  extractionInstructions,
  validatedExtraction,
} from "./trusted-extraction";
import { recordProductEvent } from "./product-events";

export async function processMemoryTurn(turnId: string | null = null) {
  const db = createServerAdminClient();
  const { data, error } = await db.rpc("claim_memory_turn", { p_id: turnId });
  if (error) throw Error("Could not claim memory task");
  const turn = data?.[0];
  if (!turn) return "idle";
  try {
    const pref = await db
      .from("user_settings")
      .select("memory_enabled")
      .eq("user_id", turn.user_id)
      .maybeSingle();
    if (pref.error) throw Error("Memory settings unavailable");
    let result: Record<string, unknown> = { facts: [], people: [] };
    if (!turn.excluded && pref.data?.memory_enabled !== false) {
      const [rows, keys] = await Promise.all([
        db
          .from("chat_messages")
          .select("id,role,content")
          .eq("session_id", turn.session_id)
          .in("id", [turn.user_message_id, turn.assistant_message_id]),
        db
          .from("memory_summaries")
          .select("memory_key")
          .eq("companion_id", turn.companion_id)
          .not("memory_key", "is", null)
          .order("updated_at", { ascending: false })
          .limit(80),
      ]);
      if (rows.error || keys.error) throw Error("Sources unavailable");
      const user = rows.data.find(
        (m) => m.role === "user" && m.id === turn.user_message_id,
      );
      const assistant = rows.data.find(
        (m) => m.role === "assistant" && m.id === turn.assistant_message_id,
      );
      if (!user || !assistant) throw Error("Invalid sources");
      const guarded = await withGenerationGuard(
        turn.user_id,
        async () => {
          const completion =
            await createCompanionClient().chat.completions.create({
              model: getCompanionModel(),
              temperature: 0.2,
              max_tokens: 2400,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: extractionInstructions },
                {
                  role: "user",
                  content: JSON.stringify({
                    user: user.content,
                    assistant: assistant.content,
                    locale: turn.locale,
                    existingKeys: keys.data.map((x) => x.memory_key),
                  }),
                },
              ],
            });
          if (completion.choices[0]?.finish_reason !== "stop")
            throw Error("Incomplete extraction");
          const extracted = validatedExtraction(
            JSON.parse(completion.choices[0]?.message.content || "null"),
            user.content,
          );
          const facts = await Promise.all(
            extracted.facts.map(async (fact) => {
              const vec = await embedText(fact.quote, 2500);
              return {
                ...fact,
                embedding: vec?.length === 1024 ? JSON.stringify(vec) : null,
              };
            }),
          );
          const eventVector = extracted.event ? await embedText(extracted.event.description,2500) : null;
          const event = extracted.event && {...extracted.event, embedding:eventVector?.length===1024 ? JSON.stringify(eventVector) : null};
          result = { ...extracted, facts, event };
          return new Response(null, { status: 204 });
        },
        db,
      );
      if (guarded.status === 429) {
        const deferred = await db
          .from("chat_turns")
          .update({
            job_state: "pending",
            job_lease: null,
            attempts: Math.max(0, turn.attempts - 1),
            next_attempt_at: new Date(Date.now() + 60000).toISOString(),
          })
          .eq("id", turn.id)
          .eq("job_lease", turn.job_lease);
        if (deferred.error) throw Error("Could not defer task");
        return "deferred";
      }
      if (!guarded.ok) throw Error("Generation guard unavailable");
    }
    const saved = await db.rpc("apply_turn_memory", {
      p_id: turn.id,
      p_lease: turn.job_lease,
      p_result: result,
    });
    if (saved.error) throw Error("Could not apply memory");
    await recordProductEvent(db, turn.user_id, "memory_extract_completed", {
      companionId: turn.companion_id,
      locale: turn.locale,
    });
    return "done";
  } catch {
    const failed = await db
      .from("chat_turns")
      .update({
        job_state: turn.attempts >= 5 ? "failed" : "pending",
        job_lease: null,
        next_attempt_at: new Date(
          Date.now() + Math.min(3600, 30 * 2 ** turn.attempts) * 1000,
        ).toISOString(),
      })
      .eq("id", turn.id)
      .eq("job_lease", turn.job_lease);
    if (failed.error) throw Error("Could not record retry");
    await recordProductEvent(db, turn.user_id, "memory_extract_failed", {
      companionId: turn.companion_id,
      details: { reason: "extraction_failed" },
    });
    return "failed";
  }
}
