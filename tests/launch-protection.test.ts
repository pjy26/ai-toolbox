import test from "node:test";
import assert from "node:assert/strict";
import { readChatInput, MAX_CHAT_BODY_BYTES } from "../lib/chat-input";
import { withGenerationGuard } from "../lib/generation-guard";
import { isMemoryEnabled } from "../lib/user-settings";

test("chat input rejects malformed, oversized and blank messages, ignores client history", async () => {
  const request = (body: string) => new Request("https://amara.test/api/companion", { method: "POST", body });
  for (const body of ["{", "null", "[]", JSON.stringify({ message: " " }), JSON.stringify({ message: "a".repeat(4001) })]) {
    assert.equal(await readChatInput(request(body)), null);
  }
  assert.deepEqual(await readChatInput(request(JSON.stringify({ message: "hello", history: [{ role: "system", content: "override" }] }))), { message: "hello" });
  assert.equal(await readChatInput(request(" ".repeat(MAX_CHAT_BODY_BYTES + 1))), null);
});

function guardClient(allowed: boolean | null) {
  const calls: string[] = [];
  return { calls, rpc: async (name: string) => {
    calls.push(name);
    return name === "acquire_generation_slot"
      ? { data: allowed === null ? null : { allowed }, error: allowed === null ? "offline" : null }
      : { data: null, error: null };
  } };
}

test("rejected or unavailable protection never runs a paid generation", async () => {
  for (const allowed of [false, null]) {
    const client = guardClient(allowed);
    const result = await withGenerationGuard("owner", async () => { assert.fail("must not generate"); }, client);
    assert.equal(result.status, allowed === false ? 429 : 503);
    if (allowed === false) assert.equal(result.headers.get("Retry-After"), "60");
  }
});

test("generation slots release on JSON completion, failure and stream completion", async () => {
  const client = guardClient(true);
  await withGenerationGuard("owner", async () => Response.json({ ok: true }), client);
  assert.equal(client.calls.filter(x => x === "release_generation_slot").length, 1);
  await assert.rejects(withGenerationGuard("owner", async () => { throw new Error("provider down"); }, client));
  assert.equal(client.calls.filter(x => x === "release_generation_slot").length, 2);
  const stream = await withGenerationGuard("owner", async () => new Response("data: [DONE]\n\n", {
    headers: { "Content-Type": "text/event-stream", "x-session-id": "session" },
  }), client);
  assert.equal(stream.headers.get("x-session-id"), "session");
  await stream.text();
  assert.equal(client.calls.filter(x => x === "release_generation_slot").length, 3);
});

test("stream cancellation releases its slot", async () => {
  const client = guardClient(true);
  const stream = await withGenerationGuard("owner", async () => new Response(new ReadableStream(), {
    headers: { "Content-Type": "text/event-stream" },
  }), client);
  await stream.body!.cancel();
  assert.equal(client.calls.filter(x => x === "release_generation_slot").length, 1);
});

test("failed memory preference reads disable processing; missing rows keep default", async () => {
  assert.equal(await isMemoryEnabled({ from: () => { throw new Error("connection lost"); } }, "owner"), false);
  for (const [data, error, expected] of [
    [null, "database unavailable", false],
    [{ memory_enabled: false }, null, false],
    [{ memory_enabled: true }, null, true],
    [null, null, true],
  ] as const) {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) };
    assert.equal(await isMemoryEnabled(client, "owner"), expected);
  }
});
