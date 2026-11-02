const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

// All scheduler dependencies are local fakes: no model, safety API, database, or env secrets.
require("sucrase/register");
const root = path.resolve(__dirname, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const mapped = request.startsWith("@/") ? path.join(root, request.slice(2)) : request;
  return resolveFilename.call(this, mapped, parent, isMain, options);
};

function mockModule(relativePath, exports) {
  const filename = require.resolve(relativePath);
  const cached = new Module(filename);
  cached.filename = filename;
  cached.loaded = true;
  cached.exports = exports;
  require.cache[filename] = cached;
}

const actualDream = require("../lib/dream.ts");
let generateDreamImpl;
let activeAdmin;
let safetyCalls = [];
mockModule("../lib/dream.ts", {
  ...actualDream,
  generateDream: (input) => generateDreamImpl(input),
});
mockModule("../lib/supabase.ts", { createServerAdminClient: () => activeAdmin });
mockModule("../lib/content-safety.ts", {
  scanWaffoContent: async (text, locale, stage) => {
    safetyCalls.push({ text, locale, stage });
    return { action: "allow" };
  },
});
const { runNightlyJobs } = require("../lib/dream-nightly.ts");

const NOW = new Date("2026-11-02T15:00:00.000Z"); // 23:00 in Asia/Shanghai.

class FakeQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.operation = "select";
    this.filters = [];
    this.orders = [];
    this.returning = false;
    this.rowLimit = null;
  }

  select() { this.returning = true; return this; }
  eq(field, value) { this.filters.push((row) => row[field] === value); return this; }
  in(field, values) { this.filters.push((row) => values.includes(row[field])); return this; }
  gte(field, value) { this.filters.push((row) => row[field] >= value); return this; }
  lt(field, value) { this.filters.push((row) => row[field] < value); return this; }
  order(field, options) { this.orders.push({ field, ascending: options?.ascending !== false }); return this; }
  limit(value) { this.rowLimit = value; return this; }
  update(values) { this.operation = "update"; this.values = values; return this; }

  async insert(value) {
    const rows = Array.isArray(value) ? value : [value];
    this.db.writes.push({ table: this.table, operation: "insert", rows });
    for (const row of rows) {
      if (
        this.table === "dream_entries" &&
        ["draft", "published"].includes(row.status) &&
        this.db.dream_entries.some((existing) =>
          existing.companion_id === row.companion_id &&
          existing.local_date === row.local_date &&
          ["draft", "published"].includes(existing.status)
        )
      ) {
        return { data: null, error: { code: "23505", message: "duplicate active Dream" } };
      }
      this.db[this.table].push({
        id: row.id || `${this.table}-${this.db.nextId++}`,
        created_at: row.created_at || NOW.toISOString(),
        ...row,
      });
    }
    return { data: null, error: null };
  }

  async upsert(value, options) {
    this.db.writes.push({ table: this.table, operation: "upsert", rows: [value] });
    if (this.table !== "nightly_jobs") throw new Error(`Unexpected upsert: ${this.table}`);
    const existing = this.db.nightly_jobs.find((row) =>
      row.companion_id === value.companion_id &&
      row.job_type === value.job_type &&
      row.local_date === value.local_date
    );
    if (existing && options?.ignoreDuplicates) return { data: null, error: null };
    if (existing) return { data: null, error: { code: "23505", message: "duplicate job" } };
    this.db.nightly_jobs.push({
      id: `job-${this.db.nextId++}`,
      attempts: 0,
      started_at: null,
      finished_at: null,
      created_at: NOW.toISOString(),
      ...value,
    });
    return { data: null, error: null };
  }

  matches() {
    return this.db[this.table].filter((row) => this.filters.every((filter) => filter(row)));
  }

  async execute(expectOne, maybe) {
    let rows = this.matches();
    if (this.operation === "update") {
      this.db.writes.push({ table: this.table, operation: "update", rows });
      rows.forEach((row) => Object.assign(row, this.values));
    } else {
      rows = [...rows];
      for (let index = this.orders.length - 1; index >= 0; index -= 1) {
        const { field, ascending } = this.orders[index];
        rows.sort((left, right) => {
          const result = left[field] < right[field] ? -1 : left[field] > right[field] ? 1 : 0;
          return ascending ? result : -result;
        });
      }
      if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    }

    if (expectOne) {
      if (rows.length === 0 && maybe) return { data: null, error: null };
      if (rows.length !== 1) return { data: null, error: { message: `Expected one ${this.table} row, got ${rows.length}` } };
      return { data: rows[0], error: null };
    }
    return { data: this.returning || this.operation === "select" ? rows : null, error: null };
  }

  single() { return this.execute(true, false); }
  maybeSingle() { return this.execute(true, true); }
  then(resolve, reject) { return this.execute(false, false).then(resolve, reject); }
}

function fakeAdmin(db) {
  return { from(table) {
    if (!db[table]) throw new Error(`Unexpected table: ${table}`);
    return new FakeQuery(db, table);
  } };
}

function makeDb(overrides = {}) {
  return {
    nextId: 1,
    writes: [],
    companions: [{
      id: "companion-1",
      user_id: "user-1",
      relationship_type: "friend",
      companion_name: "Amara",
      user_nickname: "Alex",
      persona: "gentle",
      relationship_stage: 5,
      last_active_at: NOW.toISOString(),
    }],
    user_settings: [{
      user_id: "user-1",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      dream_enabled: true,
      memory_enabled: true,
    }],
    nightly_jobs: [],
    dream_entries: [],
    chat_sessions: [{ id: "session-1", companion_id: "companion-1" }],
    chat_messages: [
      { id: "message-user", role: "user", content: "今天终于把难做的事情完成了。", created_at: "2026-11-02T10:00:00.000Z", session_id: "session-1" },
      { id: "message-assistant", role: "assistant", content: "这很值得轻轻庆祝。", created_at: "2026-11-02T10:01:00.000Z", session_id: "session-1" },
    ],
    memory_summaries: [{ id: "memory-1", summary: "喜欢安静庆祝", importance: 4, updated_at: NOW.toISOString(), companion_id: "companion-1" }],
    relationship_events: [{ id: "event-1", description: "完成一个困难目标", occurred_at: NOW.toISOString(), companion_id: "companion-1" }],
    ...overrides,
  };
}

function validGeneratedDream(input) {
  const userMessage = input.messages.find((message) => message.role === "user");
  return {
    model: "offline-test-model",
    dream: {
      title: "没有时钟的小站",
      content: "这是一场完全虚构的梦，只留下对话里轻柔的颜色和一点安静的光。",
      emotional_theme: "quiet_relief",
      next_day_hook: null,
      source_message_ids: [userMessage.id],
      source_memory_ids: input.memories.map((memory) => memory.id),
      source_event_ids: input.events.map((event) => event.id),
    },
  };
}

test.beforeEach(() => {
  safetyCalls = [];
  generateDreamImpl = async (input) => validGeneratedDream(input);
});

test("来源 ID 仅允许本轮真实输入，去重且拒绝空消息来源", () => {
  const allowed = {
    messageIds: new Set(["message-1"]),
    memoryIds: new Set(["memory-1"]),
    eventIds: new Set(["event-1"]),
  };
  const output = {
    title: "A fictional station",
    content: "An entirely imagined station holds only colors from a conversation.",
    emotional_theme: null,
    next_day_hook: null,
    source_message_ids: ["message-1", "message-1"],
    source_memory_ids: ["memory-1"],
    source_event_ids: ["event-1"],
  };
  const validated = actualDream.validateDreamOutput(output, allowed);
  assert.deepEqual(validated.source_message_ids, ["message-1"]);
  assert.deepEqual(validated.source_memory_ids, ["memory-1"]);
  assert.deepEqual(validated.source_event_ids, ["event-1"]);

  for (const field of ["source_message_ids", "source_memory_ids", "source_event_ids"]) {
    assert.throws(
      () => actualDream.validateDreamOutput({ ...output, [field]: ["fabricated-id"] }, allowed),
      /unapproved source/,
    );
  }
  assert.throws(
    () => actualDream.validateDreamOutput({ ...output, source_message_ids: [] }, allowed),
    /must cite a real conversation message/,
  );
});

test("当天没有用户消息时跳过，不调用生成或写入梦境", async () => {
  const db = makeDb({
    chat_messages: [{ id: "assistant-only", role: "assistant", content: "晚安。", created_at: "2026-11-02T10:00:00.000Z", session_id: "session-1" }],
  });
  activeAdmin = fakeAdmin(db);
  let generations = 0;
  generateDreamImpl = async () => { generations += 1; throw new Error("must not generate"); };

  const result = await runNightlyJobs(NOW);
  assert.equal(result.due, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
  assert.equal(generations, 0);
  assert.equal(db.dream_entries.length, 0);
  assert.equal(db.nightly_jobs[0].status, "skipped");
  assert.equal(db.nightly_jobs[0].attempts, 1);
  assert.equal(db.nightly_jobs[0].range_start, "2026-11-01T16:00:00.000Z");
  assert.equal(db.nightly_jobs[0].range_end, "2026-11-02T16:00:00.000Z");
});

test("用户时区内成功发布，重复调度不重复生成或插入", async () => {
  const db = makeDb();
  activeAdmin = fakeAdmin(db);
  const inputs = [];
  generateDreamImpl = async (input) => { inputs.push(input); return validGeneratedDream(input); };

  const first = await runNightlyJobs(NOW);
  const second = await runNightlyJobs(NOW);
  assert.equal(first.succeeded, 1);
  assert.equal(second.already_processed, 1);
  assert.equal(inputs.length, 1);
  assert.equal(db.dream_entries.length, 1);
  assert.equal(db.nightly_jobs.length, 1);
  assert.equal(db.nightly_jobs[0].status, "succeeded");
  assert.equal(db.dream_entries[0].local_date, "2026-11-02");
  assert.equal(db.dream_entries[0].timezone, "Asia/Shanghai");
  assert.deepEqual(db.dream_entries[0].source_message_ids, ["message-user"]);
  assert.deepEqual(db.dream_entries[0].source_memory_ids, ["memory-1"]);
  assert.deepEqual(db.dream_entries[0].source_event_ids, ["event-1"]);
  assert.equal(safetyCalls.length, 1);
  assert.equal(safetyCalls[0].stage, "dream");
  assert.equal(safetyCalls[0].locale, "zh");
  assert.deepEqual(
    db.writes.filter((write) => ["memory_summaries", "user_profiles", "relationship_events"].includes(write.table)),
    [],
  );
});

test("dream_enabled 关闭不建任务，memory_enabled 关闭不读取为来源", async () => {
  const disabled = makeDb({ user_settings: [{ ...makeDb().user_settings[0], dream_enabled: false }] });
  activeAdmin = fakeAdmin(disabled);
  const disabledResult = await runNightlyJobs(NOW);
  assert.equal(disabledResult.due, 0);
  assert.equal(disabled.nightly_jobs.length, 0);

  const db = makeDb({ user_settings: [{ ...makeDb().user_settings[0], memory_enabled: false }] });
  activeAdmin = fakeAdmin(db);
  let input;
  generateDreamImpl = async (value) => { input = value; return validGeneratedDream(value); };
  const result = await runNightlyJobs(NOW);
  assert.equal(result.succeeded, 1);
  assert.deepEqual(input.memories, []);
  assert.deepEqual(input.events.map((event) => event.id), ["event-1"]);
  assert.deepEqual(db.dream_entries[0].source_memory_ids, []);
});

test("生成错误记录失败并可在下一轮重试成功", async () => {
  const db = makeDb();
  activeAdmin = fakeAdmin(db);
  let attempts = 0;
  generateDreamImpl = async (input) => {
    attempts += 1;
    if (attempts === 1) throw new Error("offline test failure");
    return validGeneratedDream(input);
  };

  const failed = await runNightlyJobs(NOW);
  assert.equal(failed.failed, 1);
  assert.equal(db.nightly_jobs[0].status, "failed");
  assert.equal(db.nightly_jobs[0].attempts, 1);
  assert.match(db.nightly_jobs[0].last_error, /offline test failure/);

  const retried = await runNightlyJobs(NOW);
  assert.equal(retried.succeeded, 1);
  assert.equal(attempts, 2);
  assert.equal(db.nightly_jobs[0].status, "succeeded");
  assert.equal(db.nightly_jobs[0].attempts, 2);
  assert.equal(db.dream_entries.length, 1);
});

test("并发唯一键冲突按幂等成功收尾，不产生第二条活跃梦", async () => {
  const db = makeDb();
  activeAdmin = fakeAdmin(db);
  const originalInsert = FakeQuery.prototype.insert;
  let raced = false;
  FakeQuery.prototype.insert = async function (value) {
    if (this.table === "dream_entries" && !raced) {
      raced = true;
      this.db.dream_entries.push({
        ...value,
        id: "concurrent-winner",
        created_at: NOW.toISOString(),
      });
    }
    return originalInsert.call(this, value);
  };
  try {
    const result = await runNightlyJobs(NOW);
    assert.equal(result.succeeded, 1);
    assert.equal(result.failed, 0);
    assert.equal(db.dream_entries.length, 1);
    assert.equal(db.dream_entries[0].id, "concurrent-winner");
    assert.equal(db.nightly_jobs[0].status, "succeeded");
  } finally {
    FakeQuery.prototype.insert = originalInsert;
  }
});
