const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

// Pure offline tests: no Next server, model request, API request, or database.
require("sucrase/register");
const root = path.resolve(__dirname, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const mapped = request.startsWith("@/") ? path.join(root, request.slice(2)) : request;
  return resolveFilename.call(this, mapped, parent, isMain, options);
};

const {
  LETTER_MILESTONES,
  evaluateLetterMaterial,
  hasActiveMembership,
  selectNextLetterMilestone,
  summarizeLetterMaterial,
} = require("../lib/letter-policy.ts");
const {
  canAccessLetter,
  countUnreadLetters,
  letterUnreadCountFromEvent,
} = require("../lib/letter.ts");

const richMaterial = { userMessageCount: 50, substantiveUserMessageCount: 30, contextRecordCount: 5 };

test("里程碑按明确顺序推进，已删除里程碑也不会重新开放", () => {
  const used = new Set();
  assert.equal(selectNextLetterMilestone(100, richMaterial, used).key, "getting-acquainted");
  used.add("getting-acquainted");
  assert.equal(selectNextLetterMilestone(100, richMaterial, used).key, "growing-familiar");

  // The generation query includes deleted rows, so this set represents every status.
  for (const milestone of LETTER_MILESTONES) used.add(milestone.key);
  assert.equal(selectNextLetterMilestone(100, richMaterial, used), null);
});

test("材料门槛只计算真实用户消息，助手开场白不算了解材料", () => {
  const milestone = LETTER_MILESTONES[0];
  const assistantOnly = summarizeLetterMaterial([
    { role: "assistant", content: "I am always here and know you so well." },
    { role: "assistant", content: "Please tell me more about your whole day." },
  ], 0, 0);
  assert.deepEqual(assistantOnly, { userMessageCount: 0, substantiveUserMessageCount: 0, contextRecordCount: 0 });
  assert.deepEqual(evaluateLetterMaterial(milestone, 100, assistantOnly), { eligible: false, reason: "insufficient_user_messages" });
});

test("短回复数量不能替代实质材料，后续里程碑还需要真实记忆或事件", () => {
  const messages = [
    { role: "user", content: "嗯" },
    { role: "user", content: "好" },
    { role: "user", content: "今天终于完成了拖延很久的演讲稿" },
    { role: "user", content: "谢谢" },
  ];
  const material = summarizeLetterMaterial(messages, 0, 0);
  assert.equal(material.userMessageCount, 4);
  assert.equal(material.substantiveUserMessageCount, 1);
  assert.deepEqual(evaluateLetterMaterial(LETTER_MILESTONES[0], 100, material), {
    eligible: false,
    reason: "insufficient_substantive_material",
  });
  assert.deepEqual(evaluateLetterMaterial(LETTER_MILESTONES[1], 100, {
    userMessageCount: 20,
    substantiveUserMessageCount: 10,
    contextRecordCount: 0,
  }), { eligible: false, reason: "insufficient_context" });
});

test("阶段不足时即使材料很多也不会生成", () => {
  assert.deepEqual(evaluateLetterMaterial(LETTER_MILESTONES[0], 5, richMaterial), {
    eligible: false,
    reason: "insufficient_stage",
  });
});

test("会员边界与现有付费/赠送到期规则一致", () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  assert.equal(hasActiveMembership({ membership_type: "monthly", membership_expires_at: "2026-11-03T00:00:00.000Z" }, now), true);
  assert.equal(hasActiveMembership({ membership_type: "monthly", membership_expires_at: "2026-11-01T00:00:00.000Z" }, now), false);
  assert.equal(hasActiveMembership({ manual_membership_type: "yearly", manual_membership_expires_at: "2026-12-01T00:00:00.000Z" }, now), true);
  assert.equal(hasActiveMembership({ membership_type: "free", membership_expires_at: "2026-12-01T00:00:00.000Z" }, now), false);
  assert.equal(hasActiveMembership(null, now), false);
});

test("未读只统计已发布且 read_at 为空的信件", () => {
  assert.equal(countUnreadLetters([
    { status: "published", read_at: null },
    { status: "published", read_at: "2026-11-02T00:00:00.000Z" },
    { status: "draft", read_at: null },
    { status: "deleted", read_at: null },
  ]), 1);
});

test("权限辅助拒绝匿名、越权和草稿读取", () => {
  const owned = { user_id: "user-a", status: "published" };
  assert.equal(canAccessLetter("user-a", owned), true);
  assert.equal(canAccessLetter("user-b", owned), false);
  assert.equal(canAccessLetter(null, owned), false);
  assert.equal(canAccessLetter("user-a", { ...owned, status: "draft" }), false);
  assert.equal(canAccessLetter("user-a", { ...owned, status: "deleted" }), true);
});

test("AppShell 事件兼容原布尔值并支持精确未读数", () => {
  assert.equal(letterUnreadCountFromEvent(true), 1);
  assert.equal(letterUnreadCountFromEvent(false), 0);
  assert.equal(letterUnreadCountFromEvent({ unreadCount: 3 }), 3);
  assert.equal(letterUnreadCountFromEvent({ unreadCount: -2 }), 0);
  assert.equal(letterUnreadCountFromEvent({ nope: true }), null);
});
