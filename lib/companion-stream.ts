import { contentSafetyMessage, contentSafetyUnavailableMessage, type ContentReview } from "@/lib/content-safety";
import type { CompanionGenerationResult } from "@/lib/companion-model";

interface CompanionStreamOptions {
  locale: "en" | "zh";
  requestId: string;
  generate: () => Promise<CompanionGenerationResult>;
  review: (text: string) => Promise<ContentReview>;
  onPersist: (text: string) => Promise<void>;
}

/** Model text is never emitted or persisted before the complete output review. */
export function createCompanionStream({
  locale,
  requestId,
  generate,
  review,
  onPersist,
}: CompanionStreamOptions) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      controller.enqueue(encoder.encode(": heartbeat\n\n"));
      try {
        const generation = await generate();
        const assistantFull = generation.text;
        if (!assistantFull.trim()) {
          send({
            error: locale === "zh" ? "我这次没能组织好语言，请再发一次。" : "I couldn’t put my thoughts into words. Please send that again.",
            code: "EMPTY_MODEL_RESPONSE",
          });
          controller.close();
          return;
        }

        const outputReview = await review(assistantFull);
        if (outputReview.status !== "allowed") {
          const unavailable = outputReview.status === "unavailable";
          send({
            error: unavailable ? contentSafetyUnavailableMessage(locale) : contentSafetyMessage(locale, "output"),
            code: unavailable ? "OUTPUT_REVIEW_UNAVAILABLE" : "OUTPUT_REVIEW_BLOCKED",
          });
          controller.close();
          return;
        }

        for (let offset = 0; offset < assistantFull.length; offset += 24) {
          send({ choices: [{ delta: { content: assistantFull.slice(offset, offset + 24) } }] });
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        await onPersist(assistantFull);
        controller.close();
      } catch (error) {
        const err = error as any;
        console.error("[companion stream] Request failed", {
          requestId,
          name: err instanceof Error ? err.name : "UnknownError",
          status: err?.status ?? null,
          code: err?.code ?? null,
        });
        send({
          error: locale === "zh" ? "回复生成暂时失败，请稍后再试。" : "I couldn’t generate a response just now. Please try again shortly.",
          code: "STREAM_ERROR",
        });
        controller.close();
      }
    },
  });
}
