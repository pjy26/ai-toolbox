import { after, NextResponse } from "next/server";
import { getMembershipStatus } from "@/lib/auth";
import { withGenerationGuard } from "@/lib/generation-guard";
import { createServerAdminClient } from "@/lib/supabase";
import { processMemoryTurn } from "@/lib/memory-worker";
import { matchCompanionPersona } from "@/lib/persona-matching";
import { computeStageAdvance } from "@/lib/amara-persona";
import { normalizeConversationLocale } from "@/lib/conversation-context";
import {
  contentSafetyMessage,
  reviewContentSafety,
  scanWaffoContent,
} from "@/lib/content-safety";
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
import { recordProductEvent } from "@/lib/product-events";

export interface CompanionTurnInput {
  message: string;
  companion_id?: string;
  session_id?: string | null;
  locale?: string;
  timezone?: string;
  client_turn_id?: string;
}

/**
 * The single conversation pipeline for both browser chat and external channels.
 * The caller authenticates the user and validates the transport-specific input.
 */
export async function runCompanionTurn({
  userId,
  input,
  signal,
  supabase,
}: {
  userId: string;
  input: CompanionTurnInput;
  signal?: AbortSignal;
  supabase: any;
}): Promise<Response> {
  return withGenerationGuard(userId, async () => {
    const membership = await getMembershipStatus(userId, supabase);
    const isMember = membership.isMember;
    const {
      message,
      companion_id,
      session_id,
      locale: requestedLocale,
      timezone: requestedTimezone,
    } = input;
    const locale = normalizeConversationLocale(requestedLocale);
    const timezone = typeof requestedTimezone === "string" ? requestedTimezone : "UTC";
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }
    if (!companion_id) {
      return NextResponse.json({ error: "缺少 companion_id" }, { status: 400 });
    }
    if (!(await scanWaffoContent(message, locale, "input"))) {
      return NextResponse.json(
        {
          error: contentSafetyMessage(locale, "input"),
          code: "CONTENT_REVIEW_REQUIRED",
        },
        { status: 422 },
      );
    }

    const { data: companionData, error: compErr } = await supabase
      .from("companions")
      .select(
        "id, user_id, relationship_type, gender, companion_name, user_nickname, persona, persona_locked_at, relationship_stage, stage_date, stage_day_count, emotion_state, live_state, last_active_at",
      )
      .eq("id", companion_id)
      .eq("user_id", userId)
      .single();
    const companion = companionData as CompanionRow | null;

    if (compErr || !companion) {
      console.error("[companion turn] Companion lookup failed", {
        companion_id,
        userId,
        compErr: compErr?.message,
        compErrCode: compErr?.code,
      });
      return NextResponse.json({ error: "陪伴角色不存在" }, { status: 404 });
    }

    const admin = createServerAdminClient();
    const turnId = input.client_turn_id || crypto.randomUUID();
    const lease = crypto.randomUUID();
    const { data: turn, error: claimError } = await admin.rpc(
      "begin_companion_turn",
      {
        p_id: turnId,
        p_user: userId,
        p_companion: companion_id,
        p_session: session_id || null,
        p_text: message,
        p_locale: locale,
        p_lease: lease,
      },
    );
    if (claimError || !turn) {
      return NextResponse.json({ error: "Chat storage unavailable" }, { status: 503 });
    }
    if (turn.state === "missing") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (turn.state === "busy" || turn.state === "conflict") {
      return NextResponse.json(
        {
          error: turn.state === "busy"
            ? "Reply still in progress. Please retry shortly."
            : "Conflicting message identity.",
          code: turn.state,
        },
        { status: 409 },
      );
    }
    const sessionId = turn.session_id;
    const headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "x-session-id": sessionId,
      "x-user-message-id": turn.message_id,
      "x-is-member": isMember ? "1" : "0",
    };
    if (turn.state === "complete") {
      const chunk = JSON.stringify({ choices: [{ delta: { content: turn.reply } }] });
      return new Response("data: " + chunk + "\n\ndata: [DONE]\n\n", {
        headers: { ...headers, "x-reply-message-id": turn.reply_id },
      });
    }

    async function releaseTurn() {
      await admin
        .from("chat_turns")
        .update({ request_until: new Date(0).toISOString() })
        .eq("id", turnId)
        .eq("request_lease", lease)
        .is("assistant_message_id", null);
    }

    try {
      const { userGender, profileText, memText, eventsText, vetoText } =
        await loadCompanionContext(
          supabase,
          companion_id,
          userId,
          isMember,
          message,
          locale,
        );

      const { data: history, error: historyError } = await admin.rpc(
        "turn_history",
        { p_turn: turnId, p_user: userId },
      );
      if (historyError) throw Error("History unavailable");
      const dbHistory = (history || []).reverse();
      const freshEmotionState = getFreshState(
        companion.emotion_state,
        EMOTION_STATE_TTL_MS,
      );
      const freshLiveState = getFreshState(companion.live_state, LIVE_STATE_TTL_MS);
      const updates: any = { last_active_at: new Date().toISOString() };
      if (companion.relationship_type === "lover") {
        const adv = computeStageAdvance({
          ...companion,
          emotion_state: freshEmotionState,
        });
        if (adv) Object.assign(updates, adv);
      }
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
        clientHistory: [],
        locale,
        timezone,
      });
      const requestId = crypto.randomUUID();
      const readable = createCompanionStream({
        locale,
        requestId,
        generate: () =>
          generateCompanionText({
            messages,
            mode: "stream",
            temperature: 0.7,
            requestId,
            signal,
          }),
        review: (text) => reviewContentSafety(text, locale, "output"),
        onError: async (reason) => {
          await releaseTurn();
          await recordProductEvent(supabase, userId, "chat_reply_failed", {
            companionId: companion_id,
            locale,
            details: { reason },
          });
        },
        onPersist: async (assistantFull) => {
          const { error } = await admin.rpc("finish_companion_turn", {
            p_id: turnId,
            p_lease: lease,
            p_reply: assistantFull,
          });
          if (error) throw Error("Reply persistence failed");
          await supabase.from("companions").update(updates).eq("id", companion_id);
          await recordProductEvent(supabase, userId, "chat_reply_completed", {
            companionId: companion_id,
            locale,
          });
        },
      });

      after(async () => {
        try {
          await processMemoryTurn(turnId);
        } catch {
          console.warn("[memory] task remains queued");
        }
      });
      if (companion.relationship_type === "lover" && !companion.persona_locked_at) {
        after(async () => {
          try {
            await withGenerationGuard(userId, () =>
              matchCompanionPersona(supabase, userId, companion.id),
            );
          } catch {
            console.warn("[persona] background matching unavailable");
          }
        });
      }
      return new Response(readable, { headers });
    } catch {
      await releaseTurn();
      return NextResponse.json({ error: "Chat temporarily unavailable" }, { status: 503 });
    }
  });
}
