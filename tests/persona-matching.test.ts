import test from "node:test";
import assert from "node:assert/strict";
import { matchCompanionPersona } from "../lib/persona-matching";

function database(companion: object | null, count = 6) {
  const updates: any[] = [];
  const filters: any[] = [];
  return { updates, filters, from(table: string) {
    let payload: unknown;
    const builder: any = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters.push([table, key, value]); return builder; },
      in: () => builder, order: () => builder, limit: () => builder,
      update: (data: unknown) => { payload = data; return builder; },
      is: () => { updates.push(payload); return Promise.resolve({ error: null }); },
      single: async () => ({ data: companion }),
      then: (resolve: any, reject: any) => Promise.resolve(table === "chat_sessions"
        ? { data: [{ id: "session" }] }
        : { count, data: Array.from({ length: 6 }, (_, i) => ({ content: "Real user message " + i })) }).then(resolve, reject),
    };
    return builder;
  } };
}
const companion = { id: "companion", user_id: "owner", relationship_type: "lover", persona_locked_at: null };

test("automatic matching uses the authenticated owner and persists a valid persona", async () => {
  const db = database(companion);
  const result = await matchCompanionPersona(db, "owner", "companion", async prompt => {
    assert.match(prompt, /Real user message/);
    return JSON.stringify({ persona: "quiet", reason: "consistent sample" });
  });
  assert.equal(result.status, 200);
  assert.ok(db.filters.some(([table, key, value]) => table === "companions" && key === "user_id" && value === "owner"));
  assert.equal(db.updates[0].persona, "quiet");
});

test("missing/locked profiles and insufficient messages do not call the model", async () => {
  for (const [profile, count] of [[null, 6], [{ ...companion, persona_locked_at: "locked" }, 6], [companion, 5]] as const) {
    const db = database(profile, count);
    await matchCompanionPersona(db, "owner", "companion", async () => { assert.fail("must not generate"); });
    assert.equal(db.updates.length, 0);
  }
});

test("malformed or invalid model output never permanently locks a persona", async () => {
  for (const output of ["", "{", "null", "{}", '{"persona":"unknown"}']) {
    const db = database(companion);
    const result = await matchCompanionPersona(db, "owner", "companion", async () => output);
    assert.ok(result.status >= 500);
    assert.equal(db.updates.length, 0);
  }
});
