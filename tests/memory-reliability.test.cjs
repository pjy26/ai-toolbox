const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

// 使用项目已有的 sucrase 运行 TypeScript；仅映射 @/，不启动 Next 或任何外部服务。
require("sucrase/register");
const root = path.resolve(__dirname, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const mapped = request.startsWith("@/") ? path.join(root, request.slice(2)) : request;
  return resolveFilename.call(this, mapped, parent, isMain, options);
};

const { daysSinceLastChat } = require("../lib/conversation-context.ts");
const {
  classifyMemoryPair,
  dedupeMemoryEntries,
  findMemoryTextMatch,
  isExpiredTransientMemory,
  mergeMemoryArrays,
} = require("../lib/memory-reliability.ts");
const { semanticRecall, RETRIEVAL_PARAMS } = require("../lib/memory-retrieval.ts");

test("用户时区下：昨天、今天和更长间隔按自然日计算", () => {
  const now = new Date("2026-11-01T18:00:00.000Z"); // 上海 2026-11-02 02:00
  assert.equal(daysSinceLastChat("2026-11-01T15:30:00.000Z", now, "Asia/Shanghai"), 1);
  assert.equal(daysSinceLastChat("2026-11-01T16:15:00.000Z", now, "Asia/Shanghai"), 0);
  assert.equal(daysSinceLastChat("2026-10-20T16:00:00.000Z", now, "Asia/Shanghai"), 12);
});

test("跨时区不会被 UTC 日期或 24 小时 rolling floor 误导", () => {
  const now = new Date("2026-11-02T08:30:00.000Z"); // 洛杉矶 11-02 00:30，UTC 也是 11-02
  const last = "2026-11-02T07:30:00.000Z"; // 洛杉矶 11-01 23:30，仅一小时前
  assert.equal(daysSinceLastChat(last, now, "America/Los_Angeles"), 1);
  assert.equal(daysSinceLastChat(last, now, "UTC"), 0);
});

test("无效、未来时间和无效 now 都返回不可信，而不是今天", () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  assert.equal(daysSinceLastChat("not-a-date", now, "Asia/Shanghai"), -1);
  assert.equal(daysSinceLastChat("2026-11-02T00:00:00.001Z", now, "Asia/Shanghai"), -1);
  assert.equal(daysSinceLastChat(now.toISOString(), new Date("invalid"), "Asia/Shanghai"), -1);
  assert.equal(daysSinceLastChat(null, now, "Asia/Shanghai"), -1);
});

test("完全重复与明显近似复述可识别，关键事实变化不会被合并", () => {
  assert.equal(classifyMemoryPair("用户喜欢喝咖啡。", "用户 喜欢 喝咖啡"), "exact");
  assert.equal(classifyMemoryPair("用户很喜欢喝咖啡", "用户喜欢喝咖啡"), "near");
  assert.equal(classifyMemoryPair("用户喜欢喝咖啡", "用户喜欢打篮球"), "distinct");
});

test("否定、数字和短句实体冲突保守拦截，不编造折中事实", () => {
  assert.equal(classifyMemoryPair("用户不喜欢咖啡", "用户喜欢咖啡"), "conflict");
  assert.equal(classifyMemoryPair("用户今年29岁", "用户今年28岁"), "conflict");
  assert.equal(classifyMemoryPair("用户喜欢狗", "用户喜欢猫"), "conflict");
  assert.equal(
    findMemoryTextMatch("用户不喜欢咖啡", ["用户喜欢咖啡"])?.relation,
    "conflict",
  );
  assert.deepEqual(
    mergeMemoryArrays(["用户喜欢咖啡"], ["用户不喜欢咖啡", "用户很喜欢咖啡"]),
    ["用户喜欢咖啡"],
  );
});

test("过期临时记忆可隐藏，长期事实、未来和无效时间不误删", () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  assert.equal(isExpiredTransientMemory("用户最近在赶项目", "2026-10-01T00:00:00.000Z", now), true);
  assert.equal(isExpiredTransientMemory("用户喜欢咖啡", "2026-10-01T00:00:00.000Z", now), false);
  assert.equal(isExpiredTransientMemory("用户最近在赶项目", "2026-11-03T00:00:00.000Z", now), false);
  assert.equal(isExpiredTransientMemory("用户最近在赶项目", "invalid", now), false);
});

test("排重保留排名最高的重要性/相关性代表，并过滤过期与冲突项", () => {
  const hits = [
    { id: "best", text: "用户喜欢喝咖啡", score: 0.9 },
    { id: "near", text: "用户很喜欢喝咖啡", score: 0.8 },
    { id: "conflict", text: "用户不喜欢喝咖啡", score: 0.7 },
    { id: "other", text: "用户喜欢打篮球", score: 0.6 },
  ];
  assert.deepEqual(
    dedupeMemoryEntries(hits, (hit) => hit.text).map((hit) => hit.id),
    ["best", "other"],
  );
});

function fakeSupabase({ memories = [], events = [], memoryError = null, eventError = null, throwMemory = false }) {
  const calls = [];
  return {
    calls,
    rpc(name, params) {
      calls.push({ name, params });
      if (name === "match_memory_summaries") {
        if (throwMemory) throw new Error("memory rpc unavailable");
        return Promise.resolve({ data: memories, error: memoryError });
      }
      if (name === "match_relationship_events") {
        return Promise.resolve({ data: events, error: eventError });
      }
      throw new Error(`unexpected rpc: ${name}`);
    },
  };
}

test("语义召回先过量取回再去重，保留 hybrid score 最高项", async () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  const memories = [
    { id: "stale", summary: "用户最近在赶项目", importance: 5, updated_at: "2026-10-01T00:00:00.000Z", score: 0.99 },
    { id: "best", summary: "用户喜欢喝咖啡", importance: 4, updated_at: now.toISOString(), score: 0.9 },
    { id: "conflict", summary: "用户不喜欢喝咖啡", importance: 5, updated_at: now.toISOString(), score: 0.88 },
    { id: "other", summary: "用户喜欢打篮球", importance: 3, updated_at: now.toISOString(), score: 0.85 },
    { id: "near", summary: "用户很喜欢喝咖啡", importance: 5, updated_at: now.toISOString(), score: 0.8 },
  ];
  const events = [
    { id: "event-best", description: "第一次一起看完电影", event_type: "milestone", importance: 4, occurred_at: now.toISOString(), score: 0.9 },
    { id: "event-near", description: "第一次一起看完电影。", event_type: "milestone", importance: 3, occurred_at: now.toISOString(), score: 0.8 },
  ];
  const supabase = fakeSupabase({ memories, events });
  const result = await semanticRecall(supabase, "companion-test", "关于咖啡和电影的长消息", {
    now,
    embed: async () => [0.1, 0.2],
  });
  assert.deepEqual(result.memories.map((hit) => hit.id), ["best", "other"]);
  assert.deepEqual(result.events.map((hit) => hit.id), ["event-best"]);
  assert.equal(supabase.calls[0].params.p_limit, RETRIEVAL_PARAMS.memoryTopK * 3);
  assert.equal(supabase.calls[1].params.p_limit, RETRIEVAL_PARAMS.eventTopK * 3);
});

test("embedding 不可用或抛错时返回 null，且不调用数据库", async () => {
  for (const embed of [async () => null, async () => { throw new Error("offline"); }]) {
    const supabase = fakeSupabase({});
    assert.equal(await semanticRecall(supabase, "companion-test", "足够长的本地测试消息", { embed }), null);
    assert.equal(supabase.calls.length, 0);
  }
});

test("两个 RPC 都失败时降级；单侧异常保留另一侧结果", async () => {
  const embed = async () => [0.1];
  const bothFailed = fakeSupabase({ memoryError: new Error("off"), eventError: new Error("off") });
  assert.equal(await semanticRecall(bothFailed, "companion-test", "足够长的本地测试消息", { embed }), null);

  const event = { id: "event", description: "一起完成拼图", event_type: "achievement", importance: 4, occurred_at: "2026-11-01T00:00:00.000Z", score: 0.8 };
  const partial = fakeSupabase({ events: [event], throwMemory: true });
  const result = await semanticRecall(partial, "companion-test", "足够长的本地测试消息", { embed });
  assert.deepEqual(result.memories, []);
  assert.deepEqual(result.events.map((hit) => hit.id), ["event"]);
});
