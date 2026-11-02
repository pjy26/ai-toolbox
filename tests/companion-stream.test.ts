import assert from "node:assert/strict";
import { createCompanionStream } from "../lib/companion-stream";

function generation(text: string) {
  return {
    text,
    attempts: 1,
    fallbackUsed: false,
    durationMs: 1,
    finishReason: "stop",
    sawReasoning: false,
    usage: null,
  };
}

async function read(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function main() {
{
  const events: string[] = [];
  let persisted = "";
  const body = await read(createCompanionStream({
    locale: "zh",
    requestId: "success",
    generate: async () => {
      events.push("generate");
      return generation("abcdefghijklmnopqrstuvwxyz1234");
    },
    review: async () => {
      events.push("review");
      return { status: "allowed", verdict: {} } as any;
    },
    onPersist: async (text) => {
      events.push("persist");
      persisted = text;
    },
  }));
  assert.ok(body.startsWith(": heartbeat\n\n"));
  assert.ok(body.includes("data: [DONE]"));
  assert.equal((body.match(/"delta"/g) || []).length, 2);
  assert.equal(persisted, "abcdefghijklmnopqrstuvwxyz1234");
  assert.deepEqual(events, ["generate", "review", "persist"]);
  assert.ok(body.indexOf("data: [DONE]") < body.length);
  console.log("✓ Success preserves heartbeat, 24-character chunks, review, DONE, and persistence");
}

for (const [status, code] of [["blocked", "OUTPUT_REVIEW_BLOCKED"], ["unavailable", "OUTPUT_REVIEW_UNAVAILABLE"]] as const) {
  let persisted = false;
  const body = await read(createCompanionStream({
    locale: "zh",
    requestId: status,
    generate: async () => generation("不能提前显示"),
    review: async () => ({ status, verdict: null }) as any,
    onPersist: async () => { persisted = true; },
  }));
  assert.ok(body.includes(code));
  assert.ok(!body.includes("不能提前显示"));
  assert.equal(persisted, false);
}
console.log("✓ Blocked and unavailable reviews neither emit nor persist model text");

{
  let reviewed = false;
  const body = await read(createCompanionStream({
    locale: "zh",
    requestId: "empty",
    generate: async () => generation("   "),
    review: async () => {
      reviewed = true;
      return { status: "allowed", verdict: {} } as any;
    },
    onPersist: async () => {},
  }));
  assert.ok(body.includes("EMPTY_MODEL_RESPONSE"));
  assert.equal(reviewed, false);
  console.log("✓ Empty model output has its own error and skips output review");
}

{
  const body = await read(createCompanionStream({
    locale: "zh",
    requestId: "failure",
    generate: async () => { throw new Error("provider secret"); },
    review: async () => ({ status: "allowed", verdict: {} }) as any,
    onPersist: async () => {},
  }));
  assert.ok(body.includes("STREAM_ERROR"));
  assert.ok(!body.includes("provider secret"));
  assert.ok(!body.includes("未通过安全检查"));
  console.log("✓ Provider failures stay sanitized and are not mislabeled as safety blocks");
}

console.log("\n5/5 companion stream tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
