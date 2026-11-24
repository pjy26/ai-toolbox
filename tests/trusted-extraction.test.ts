import test from "node:test";
import assert from "node:assert/strict";
import { validatedExtraction } from "../lib/trusted-extraction";
import { readSavedReply } from "../lib/chat-reply";
import { createCompanionStream } from "../lib/companion-stream";

test("extraction preserves negation and cannot quote the assistant or a fragment of a question", () => {
  const user =
    "I never said I live in Shanghai. 我搬到杭州了。要不要搬去上海？";
  const facts = [
    "I live in Shanghai",
    "我搬到杭州了",
    "要不要搬去上海",
    "Lives in London",
  ].map((quote, index) => ({ key: "fact" + index, quote }));
  assert.deepEqual(validatedExtraction({ facts }, user).facts, [facts[1]]);
});

test("failed persistence never delivers model text or DONE", async () => {
  const stream = createCompanionStream({
    locale: "en",
    requestId: "offline-test",
    generate: async () => ({
      text: "unsaved answer",
      attempts: 1,
      fallbackUsed: false,
      durationMs: 1,
      finishReason: "stop",
      sawReasoning: false,
      usage: null,
    }),
    review: async () => ({ status: "allowed", verdict: {} }) as any,
    onPersist: async () => {
      throw Error("offline write failure");
    },
  });
  const wire = await new Response(stream).text();
  assert.match(wire, /STREAM_ERROR/);
  assert.doesNotMatch(wire, /unsaved answer|\[DONE\]/);
  await assert.rejects(
    readSavedReply(
      new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      "disconnected",
    ),
    /disconnected/,
  );
  assert.equal(
    await readSavedReply(
      new Response(
        'data: {"choices":[{"delta":{"content":"stored"}}]}\n\ndata: [DONE]\n\n',
      ),
      "failed",
    ),
    "stored",
  );
  const deltas: string[] = [];
  const streamed = await readSavedReply(
    new Response(
      'data: {"choices":[{"delta":{"content":"he"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n\n',
    ),
    "failed",
    (delta) => deltas.push(delta),
  );
  assert.equal(streamed, "hello");
  assert.deepEqual(deltas, ["he", "llo"]);
});
