import assert from "node:assert/strict";
import {
  buildCompanionMessages,
  getFreshState,
  splitVetoMemories,
  type CompanionRow,
} from "../lib/companion-context";

const split = splitVetoMemories("- 用户最近失眠\n- 用户喜欢绿色", "zh");
assert.match(split.vetoText, /注意/);
assert.match(split.vetoText, /避免提咖啡/);
assert.equal(split.restText, "- 用户喜欢绿色");
console.log("✓ Health constraints stay separate from ordinary memories");

const now = Date.parse("2026-11-02T10:00:00.000Z");
assert.equal(getFreshState({ updated_at: "2026-11-02T09:00:00.000Z" }, 2 * 60 * 60 * 1000, now)?.updated_at, "2026-11-02T09:00:00.000Z");
assert.equal(getFreshState({ updated_at: "2026-11-02T07:00:00.000Z" }, 2 * 60 * 60 * 1000, now), null);
assert.equal(getFreshState({ mood: "tired" }, 2 * 60 * 60 * 1000, now), null);
console.log("✓ Live state requires a valid, unexpired timestamp");

const companion: CompanionRow = {
  id: "companion-1",
  user_id: "user-1",
  relationship_type: "lover",
  gender: "female",
  companion_name: "Amara",
  user_nickname: "P",
  persona: "gentle",
  relationship_stage: 1,
  last_active_at: "2026-11-01T10:00:00.000Z",
};
const messages = buildCompanionMessages({
  companion,
  userGender: "",
  profileText: "",
  memText: "",
  eventsText: "",
  vetoText: "",
  freshEmotionState: null,
  freshLiveState: null,
  message: "现在的消息",
  dbHistory: [{ role: "user", content: "旧消息" }, { role: "assistant", content: "旧回复" }],
  clientHistory: [{ role: "user", content: "旧消息" }, { role: "assistant", content: "客户端补充" }],
  locale: "zh",
  timezone: "Asia/Shanghai",
  now: new Date(now),
});
// Static prefix leads; dynamic state is a second system turn right before the
// latest user message, so cacheable content stays at the front.
assert.deepEqual(messages.map((message) => message.role), ["system", "user", "assistant", "assistant", "system", "user"]);
assert.equal(messages.filter((message) => message.content === "旧消息").length, 1);
assert.equal(messages.filter((message) => message.content === "现在的消息").length, 1);
assert.equal(messages.at(-1)?.content, "现在的消息");
assert.equal(messages.at(-2)?.role, "system");
console.log("✓ Message order, client-history dedupe, and the current-user turn stay stable");

console.log("\n3/3 companion context tests passed.");
