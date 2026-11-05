import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FREE_MESSAGE_LIMIT, getCompanionQuotaDecision } from "../lib/auth";
import { isClientProductEventName, isProductEventName } from "../lib/product-events";

assert.equal(FREE_MESSAGE_LIMIT, 30);
assert.deepEqual(getCompanionQuotaDecision({ isMember: false, freeMessagesUsed: 0 }), {
  ok: true, isMember: false, used: 0, remaining: 30,
});
assert.deepEqual(getCompanionQuotaDecision({ isMember: false, freeMessagesUsed: 29 }), {
  ok: true, isMember: false, used: 29, remaining: 1,
});
assert.deepEqual(getCompanionQuotaDecision({ isMember: false, freeMessagesUsed: 30 }), {
  ok: false, isMember: false, used: 30, remaining: 0,
});
assert.deepEqual(getCompanionQuotaDecision({ isMember: false, freeMessagesUsed: 31 }), {
  ok: false, isMember: false, used: 31, remaining: 0,
});
assert.deepEqual(getCompanionQuotaDecision({ isMember: true, freeMessagesUsed: 30 }), {
  ok: true, isMember: true, used: 30, remaining: Infinity,
});

const extractRoute = readFileSync(new URL("../app/api/companion/extract/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(extractRoute, /if\s*\(\s*!isMember\b|membership required|记忆.*会员/i);
assert.match(extractRoute, /memory_extract_completed/);
const context = readFileSync(new URL("../lib/companion-context.ts", import.meta.url), "utf8");
assert.doesNotMatch(context, /if\s*\(\s*!isMember\b/);

assert.equal(isClientProductEventName("chat_opened"), true);
assert.equal(isClientProductEventName("checkout_started"), true);
assert.equal(isClientProductEventName("chat_reply_completed"), false);
assert.equal(isClientProductEventName("memory_extract_completed"), false);
assert.equal(isClientProductEventName("quota_exhausted"), false);
assert.equal(isProductEventName("chat_reply_completed"), true, "Server-side events remain valid");
const letterGeneration = readFileSync(new URL("../lib/letter-generation.ts", import.meta.url), "utf8");
assert.match(letterGeneration, /plus_required/, "Free accounts must not generate Plus-only letters");

console.log("\n15/15 free quota, membership entitlement, and diagnostic trust-boundary tests passed.");
