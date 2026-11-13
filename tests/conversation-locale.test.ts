import test from "node:test";
import assert from "node:assert/strict";
import { matchesConversationLocale } from "../lib/conversation-context";

test("English greetings reject Chinese model output before persistence", () => {
  assert.equal(matchesConversationLocale("嗨，好几天没聊了。那天那么热闹的聚餐之后，今天有没有清静一点？", "en"), false);
  assert.equal(matchesConversationLocale("Welcome back. How have the past couple of days been?", "en"), true);
});

test("Chinese greetings require Chinese output", () => {
  assert.equal(matchesConversationLocale("Welcome back. How have you been?", "zh"), false);
  assert.equal(matchesConversationLocale("回来啦，这两天过得怎么样？", "zh"), true);
});

test("Empty or whitespace-only greetings are never accepted", () => {
  for (const locale of ["en", "zh"] as const) {
    assert.equal(matchesConversationLocale("", locale), false);
    assert.equal(matchesConversationLocale("  \n", locale), false);
  }
});
