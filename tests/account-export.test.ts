import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountExport } from "../lib/account-export";

type Row = Record<string, unknown>;
type Call = { table: string; column: string; values: string[]; from: number; to: number };

function fakeDatabase(tables: Record<string, Row[]>, failTable = "") {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const filters: { column: string; values: string[] }[] = [];
      const query: any = {
        select: () => query,
        in: (column: string, values: string[]) => { filters.push({ column, values }); return query; },
        order: () => query,
        range: async (from: number, to: number) => {
          const filter = filters[0];
          calls.push({ table, column: filter.column, values: filter.values, from, to });
          if (table === failTable) return { data: null, error: { message: "offline" } };
          const data = (tables[table] || []).filter((row) => filter.values.includes(String(row[filter.column])));
          return { data: data.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
  return { db, calls };
}

const user = { id: "owner", email: "owner@example.com", created_at: "2026-01-01", last_sign_in_at: "2026-01-02" };

test("account export scopes every privileged query to the owner and excludes internal tables", async () => {
  const { db, calls } = fakeDatabase({
    profiles: [{ id: "owner", username: "Owner" }, { id: "other", username: "Other" }],
    companions: [{ id: "c1", user_id: "owner" }, { id: "c2", user_id: "other" }],
    chat_sessions: [{ id: "s1", user_id: "owner", companion_id: "c1" }, { id: "s2", user_id: "other", companion_id: "c2" }],
    chat_messages: [{ id: "m1", session_id: "s1", content: "owner message" }, { id: "m2", session_id: "s2", content: "other-secret" }],
    memory_summaries: [{ id: "mem1", companion_id: "c1", summary: "owner memory" }, { id: "mem2", companion_id: "c2", summary: "other-secret" }],
    memory_versions: [{ id: 1, companion_id: "c1", summary: "old owner memory" }, { id: 2, companion_id: "c2", summary: "other-secret" }],
    memory_evidence: [{ memory_id: "mem1", revision: 1, message_id: "m1", companion_id: "c1" }, { memory_id: "mem2", revision: 1, message_id: "m2", companion_id: "c2" }],
    letters: [{ id: "l1", user_id: "owner", content: "owner letter" }, { id: "l2", user_id: "other", content: "other-secret" }],
    orders: [{ id: "o1", user_id: "owner" }, { id: "o2", user_id: "other" }],
  });

  const result = await buildAccountExport(db, user);
  assert.equal(result.account.email, "owner@example.com");
  assert.deepEqual(result.data.companions.map((row: any) => row.id), ["c1"]);
  assert.deepEqual(result.data.chatMessages.map((row: any) => row.id), ["m1"]);
  assert.deepEqual(result.data.memories.map((row: any) => row.id), ["mem1"]);
  assert.deepEqual(result.data.memoryVersions.map((row: any) => row.id), [1]);
  assert.deepEqual(result.data.memoryEvidence.map((row: any) => row.memory_id), ["mem1"]);
  assert.deepEqual(result.data.letters.map((row: any) => row.id), ["l1"]);
  assert.deepEqual(result.data.orders.map((row: any) => row.id), ["o1"]);
  assert.equal(JSON.stringify(result).includes("other-secret"), false);

  const allowedValues = new Set(["owner", "c1", "s1"]);
  for (const call of calls) {
    assert.ok(call.values.length > 0, `${call.table} must have an ownership filter`);
    assert.ok(call.values.every((value) => allowedValues.has(value)), `${call.table} received an out-of-scope value`);
    assert.ok(!["admin_membership_actions", "waffo_webhook_events", "nightly_jobs"].includes(call.table));
  }
});

test("account export paginates beyond the provider row limit", async () => {
  const messages = Array.from({ length: 1001 }, (_, index) => ({ id: `m${index}`, session_id: "s1", content: `message ${index}` }));
  const { db, calls } = fakeDatabase({
    companions: [{ id: "c1", user_id: "owner" }],
    chat_sessions: [{ id: "s1", user_id: "owner", companion_id: "c1" }],
    chat_messages: messages,
  });
  const result = await buildAccountExport(db, user);
  assert.equal(result.data.chatMessages.length, 1001);
  assert.deepEqual(calls.filter((call) => call.table === "chat_messages").map((call) => call.from), [0, 1000]);
});

test("account export fails instead of returning a silently incomplete file", async () => {
  const { db } = fakeDatabase({ companions: [{ id: "c1", user_id: "owner" }] }, "memory_versions");
  await assert.rejects(buildAccountExport(db, user), /Could not export memory_versions/);
});
