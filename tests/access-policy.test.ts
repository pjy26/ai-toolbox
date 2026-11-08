import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isClientProductEventName, isProductEventName } from "../lib/product-events";

const companionRoute = readFileSync(new URL("../app/api/companion/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(companionRoute, /FREE_MESSAGE_LIMIT|freeMessagesUsed|checkCompanionQuota|incFreeMessageCount|QUOTA_EXCEEDED/);
const quotaRoute = readFileSync(new URL("../app/api/companion/quota/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(quotaRoute, /FREE_MESSAGE_LIMIT|freeMessagesUsed|freeLimit|remaining/);
const chatPage = readFileSync(new URL("../app/chat/page.tsx", import.meta.url), "utf8");
assert.doesNotMatch(chatPage, /freeRemaining|freeMessagesUsed|freeLimit|quota\.remaining/);
const auth = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8");
assert.doesNotMatch(auth, /FREE_MESSAGE_LIMIT|freeMessagesUsed|free_messages_used|checkCompanionQuota|incFreeMessageCount/);

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
