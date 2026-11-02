import OpenAI from "openai";

export const COMPANION_MODEL_DEADLINE_MS = 22_000;
export const COMPANION_STREAM_IDLE_TIMEOUT_MS = 10_000;

export type CompanionModelErrorCode =
  | "MODEL_DEADLINE_EXCEEDED"
  | "MODEL_STREAM_IDLE"
  | "MODEL_CLIENT_ABORTED"
  | "MODEL_INCOMPLETE"
  | "MODEL_TRUNCATED"
  | "UPSTREAM_CONTENT_FILTER"
  | "UPSTREAM_AUTH_ERROR"
  | "UPSTREAM_BILLING_ERROR"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_SERVER_ERROR"
  | "UPSTREAM_REQUEST_ERROR"
  | "UPSTREAM_ERROR";

export class CompanionModelError extends Error {
  constructor(
    message: string,
    public code: CompanionModelErrorCode,
    public status: number | null = null,
    public providerCode: string | null = null,
  ) {
    super(message);
    this.name = "CompanionModelError";
  }
}

export interface CompanionUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
}

export interface CompanionGenerationResult {
  text: string;
  attempts: number;
  fallbackUsed: boolean;
  durationMs: number;
  finishReason: string | null;
  sawReasoning: boolean;
  usage: CompanionUsage | null;
}

interface GenerateCompanionTextOptions {
  messages: OpenAI.ChatCompletionMessageParam[];
  mode: "stream" | "non_stream";
  temperature: number;
  requestId?: string;
  signal?: AbortSignal;
  deadlineMs?: number;
  idleTimeoutMs?: number;
  client?: OpenAI;
}

interface AttemptResult {
  text: string;
  finishReason: string | null;
  sawReasoning: boolean;
  usage: CompanionUsage | null;
}

type AbortReason = "deadline" | "idle" | "client" | null;

/** Central provider defaults: no hidden SDK retries and no ten-minute request budget. */
export function createCompanionClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
    timeout: 20_000,
    maxRetries: 0,
  });
}

export function getCompanionModel() {
  return process.env.OPENAI_MODEL || "deepseek-v4-pro";
}

function normalizeUsage(raw: any): CompanionUsage | null {
  if (!raw) return null;
  const numberOrNull = (value: unknown) => typeof value === "number" ? value : null;
  return {
    promptTokens: numberOrNull(raw.prompt_tokens),
    completionTokens: numberOrNull(raw.completion_tokens),
    totalTokens: numberOrNull(raw.total_tokens),
    reasoningTokens: numberOrNull(raw.completion_tokens_details?.reasoning_tokens),
    cacheHitTokens: numberOrNull(raw.prompt_cache_hit_tokens),
    cacheMissTokens: numberOrNull(raw.prompt_cache_miss_tokens),
  };
}

function abortError(reason: Exclude<AbortReason, null>) {
  if (reason === "deadline") {
    return new CompanionModelError("Companion model deadline exceeded", "MODEL_DEADLINE_EXCEEDED");
  }
  if (reason === "idle") {
    return new CompanionModelError("Companion model stream stalled", "MODEL_STREAM_IDLE");
  }
  return new CompanionModelError("Companion model request was cancelled", "MODEL_CLIENT_ABORTED");
}

function classifyError(error: unknown, reason: AbortReason): CompanionModelError {
  if (reason) return abortError(reason);
  if (error instanceof CompanionModelError) return error;
  const err = error as any;
  const status = typeof err?.status === "number" ? err.status : null;
  const providerCode = typeof err?.code === "string" ? err.code : null;
  let code: CompanionModelErrorCode = "UPSTREAM_ERROR";
  if (status === 401) code = "UPSTREAM_AUTH_ERROR";
  else if (status === 402) code = "UPSTREAM_BILLING_ERROR";
  else if (status === 429) code = "UPSTREAM_RATE_LIMIT";
  else if (status !== null && status >= 500) code = "UPSTREAM_SERVER_ERROR";
  else if (status !== null && status >= 400) code = "UPSTREAM_REQUEST_ERROR";
  return new CompanionModelError("Companion model request failed", code, status, providerCode);
}

function validateFinish(attempt: AttemptResult) {
  const reason = attempt.finishReason;
  if (!reason) throw new CompanionModelError("Companion model stream ended without a finish reason", "MODEL_INCOMPLETE");
  if (reason === "content_filter") {
    throw new CompanionModelError("Companion model output was filtered upstream", "UPSTREAM_CONTENT_FILTER");
  }
  if (reason === "length" && attempt.text.trim()) {
    throw new CompanionModelError("Companion model output was truncated", "MODEL_TRUNCATED");
  }
  if (reason !== "stop" && reason !== "length") {
    throw new CompanionModelError("Companion model ended with an unsupported finish reason", "MODEL_INCOMPLETE");
  }
}

/**
 * One deterministic generation policy: no generic retry, at most one non-thinking
 * fallback for an empty answer, and one deadline shared by both attempts.
 */
export async function generateCompanionText({
  messages,
  mode,
  temperature,
  requestId = "unknown",
  signal,
  deadlineMs = COMPANION_MODEL_DEADLINE_MS,
  idleTimeoutMs = COMPANION_STREAM_IDLE_TIMEOUT_MS,
  client = createCompanionClient(),
}: GenerateCompanionTextOptions): Promise<CompanionGenerationResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let abortReason: AbortReason = null;
  let attempts = 0;

  const abortFromClient = () => {
    abortReason = "client";
    controller.abort();
  };
  if (signal?.aborted) abortFromClient();
  else signal?.addEventListener("abort", abortFromClient, { once: true });

  const deadlineTimer = setTimeout(() => {
    abortReason = "deadline";
    controller.abort();
  }, deadlineMs);

  const runAttempt = async (nonThinkingFallback: boolean): Promise<AttemptResult> => {
    attempts += 1;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const request: any = {
      model: getCompanionModel(),
      messages,
      temperature,
      reasoning_effort: "low",
      max_tokens: nonThinkingFallback ? 1000 : 1600,
      ...(nonThinkingFallback ? { thinking: { type: "disabled" } } : {}),
    };

    try {
      if (mode === "non_stream") {
        const completion: any = await client.chat.completions.create(request, { signal: controller.signal });
        if (abortReason) throw abortError(abortReason);
        const choice = completion.choices?.[0];
        const attempt: AttemptResult = {
          text: choice?.message?.content || "",
          finishReason: choice?.finish_reason || null,
          sawReasoning: Boolean(choice?.message?.reasoning_content),
          usage: normalizeUsage(completion.usage),
        };
        validateFinish(attempt);
        return attempt;
      }

      const stream: any = await client.chat.completions.create(
        { ...request, stream: true },
        { signal: controller.signal },
      );
      let text = "";
      let finishReason: string | null = null;
      let sawReasoning = false;
      let usage: CompanionUsage | null = null;
      const resetIdleWatchdog = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          abortReason = "idle";
          controller.abort();
        }, idleTimeoutMs);
      };
      resetIdleWatchdog();
      try {
        for await (const chunk of stream) {
          resetIdleWatchdog();
          const choice = chunk.choices?.[0];
          const delta = choice?.delta;
          text += delta?.content || "";
          if (delta?.reasoning_content) sawReasoning = true;
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (chunk.usage) usage = normalizeUsage(chunk.usage);
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }
      if (abortReason) throw abortError(abortReason);
      const attempt = { text, finishReason, sawReasoning, usage };
      validateFinish(attempt);
      return attempt;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
    }
  };

  try {
    if (abortReason) throw abortError(abortReason);
    let attempt = await runAttempt(false);
    let fallbackUsed = false;
    if (!attempt.text.trim()) {
      if (Date.now() - startedAt >= deadlineMs - 250) throw abortError("deadline");
      console.warn("[companion model] Empty answer; using non-thinking fallback", {
        requestId,
        finishReason: attempt.finishReason,
        sawReasoning: attempt.sawReasoning,
      });
      fallbackUsed = true;
      attempt = await runAttempt(true);
    }
    const result = {
      text: attempt.text,
      attempts,
      fallbackUsed,
      durationMs: Date.now() - startedAt,
      finishReason: attempt.finishReason,
      sawReasoning: attempt.sawReasoning,
      usage: attempt.usage,
    };
    console.info("[companion model] Generation completed", { requestId, mode, ...result, text: undefined });
    return result;
  } catch (error) {
    const classified = classifyError(error, abortReason);
    console.error("[companion model] Generation failed", {
      requestId,
      mode,
      attempts,
      durationMs: Date.now() - startedAt,
      code: classified.code,
      status: classified.status,
      providerCode: classified.providerCode,
    });
    throw classified;
  } finally {
    clearTimeout(deadlineTimer);
    signal?.removeEventListener("abort", abortFromClient);
  }
}
