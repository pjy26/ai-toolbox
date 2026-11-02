import assert from "node:assert/strict";
import { generateCompanionText } from "../lib/companion-model";

const messages = [{ role: "user" as const, content: "test" }];

function completion(text: string, finishReason = "stop") {
  return {
    choices: [{ message: { content: text }, finish_reason: finishReason }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
      prompt_cache_hit_tokens: 6,
      prompt_cache_miss_tokens: 4,
    },
  };
}

function fakeClient(create: (...args: any[]) => any) {
  return { chat: { completions: { create } } } as any;
}

async function main() {
{
  const calls: any[] = [];
  const result = await generateCompanionText({
    messages,
    mode: "non_stream",
    temperature: 0.7,
    client: fakeClient(async (request) => {
      calls.push(request);
      return completion("你好");
    }),
  });
  assert.equal(result.text, "你好");
  assert.equal(result.attempts, 1);
  assert.equal(calls.length, 1);
  assert.equal(result.usage?.cacheHitTokens, 6);
  console.log("✓ Non-empty generation calls the provider once and keeps usage metadata");
}

{
  const calls: any[] = [];
  const result = await generateCompanionText({
    messages,
    mode: "non_stream",
    temperature: 0.7,
    client: fakeClient(async (request) => {
      calls.push(request);
      return completion(calls.length === 1 ? "" : "想起来了");
    }),
  });
  assert.equal(result.text, "想起来了");
  assert.equal(result.attempts, 2);
  assert.equal(result.fallbackUsed, true);
  assert.equal(calls[1].thinking.type, "disabled");
  assert.equal(calls[1].max_tokens, 1000);
  console.log("✓ Empty content triggers exactly one non-thinking fallback");
}

{
  let calls = 0;
  const result = await generateCompanionText({
    messages,
    mode: "non_stream",
    temperature: 0.7,
    client: fakeClient(async () => {
      calls += 1;
      return completion("   ");
    }),
  });
  assert.equal(result.text.trim(), "");
  assert.equal(result.attempts, 2);
  assert.equal(calls, 2);
  console.log("✓ Two empty answers stop after the single fallback");
}

{
  let calls = 0;
  await assert.rejects(
    generateCompanionText({
      messages,
      mode: "non_stream",
      temperature: 0.7,
      client: fakeClient(async () => {
        calls += 1;
        const error: any = new Error("secret provider detail");
        error.status = 401;
        error.code = "invalid_request_error";
        throw error;
      }),
    }),
    (error: any) => error.code === "UPSTREAM_AUTH_ERROR" && !error.message.includes("secret"),
  );
  assert.equal(calls, 1);
  console.log("✓ Authentication failures are sanitized and never retried");
}

{
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { reasoning_content: "thinking" } }] };
      yield { choices: [{ delta: { content: "我" } }] };
      yield { choices: [{ delta: { content: "在" }, finish_reason: "stop" }], usage: { total_tokens: 8 } };
    },
  };
  const result = await generateCompanionText({
    messages,
    mode: "stream",
    temperature: 0.7,
    client: fakeClient(async () => stream),
  });
  assert.equal(result.text, "我在");
  assert.equal(result.finishReason, "stop");
  assert.equal(result.sawReasoning, true);
  assert.equal(result.usage?.totalTokens, 8);
  console.log("✓ Streaming keeps content separate from reasoning and captures finish metadata");
}

{
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: "未完成" } }] };
    },
  };
  await assert.rejects(
    generateCompanionText({ messages, mode: "stream", temperature: 0.7, client: fakeClient(async () => stream) }),
    (error: any) => error.code === "MODEL_INCOMPLETE",
  );
  console.log("✓ EOF without a finish reason is not accepted as a complete answer");
}

{
  await assert.rejects(
    generateCompanionText({
      messages,
      mode: "non_stream",
      temperature: 0.7,
      client: fakeClient(async () => completion("被截断", "length")),
    }),
    (error: any) => error.code === "MODEL_TRUNCATED",
  );
  console.log("✓ Truncated non-empty output fails closed");
}

{
  await assert.rejects(
    generateCompanionText({
      messages,
      mode: "non_stream",
      temperature: 0.7,
      deadlineMs: 15,
      client: fakeClient(async (_request, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })),
    }),
    (error: any) => error.code === "MODEL_DEADLINE_EXCEEDED",
  );
  console.log("✓ The shared deadline cancels a stalled provider request");
}

console.log("\n8/8 companion model tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
