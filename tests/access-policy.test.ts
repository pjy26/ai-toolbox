import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isClientProductEventName, isProductEventName } from "../lib/product-events";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

// 对话次数对所有方案都不设上限：Free 不能因为消息条数被挡在门外。
const auth = read("../lib/auth.ts");
assert.doesNotMatch(auth, /FREE_MESSAGE_LIMIT|getCompanionQuotaDecision|checkCompanionQuota|incFreeMessageCount/);
assert.doesNotMatch(auth, /free_messages_used|freeMessagesUsed/);
assert.match(auth, /export async function getMembershipStatus/);

const companionRoute = read("../app/api/companion/route.ts");
assert.doesNotMatch(companionRoute, /QUOTA_EXCEEDED|checkCompanionQuota|free_messages_used/);
assert.doesNotMatch(companionRoute, /status:\s*402/);
assert.match(companionRoute, /getMembershipStatus/);

// 会员状态接口只返回权益，不再返回条数配额。
const quotaRoute = read("../app/api/companion/quota/route.ts");
assert.doesNotMatch(quotaRoute, /remaining\s*:|freeLimit\s*:|freeMessagesUsed/);

// 聊天页不能在前端拦截发送，也不能再处理 402 额度响应。
const chatPage = read("../app/(space)/chat/page.tsx");
assert.doesNotMatch(chatPage, /quota\.remaining|QUOTA_EXCEEDED|status === 402/);
assert.match(chatPage, /copy\.freePlanNote/);

// 免费方案的说明与定价页一致：对话不限次数，差异在功能。
const chatCopy = read("../lib/chat-copy.ts");
assert.doesNotMatch(chatCopy, /30 free messages|30 句|free messages left/);
assert.match(chatCopy, /freePlanNote/);
const pricingPage = read("../app/pricing/page.tsx");
assert.match(pricingPage, /"Unlimited conversations"/);
assert.match(pricingPage, /"不限次数对话"/);

// 记忆抽取对所有方案开放；重要人物与共同瞬间仍按会员等级限制。
const extractRoute = read("../lib/memory-worker.ts");
assert.doesNotMatch(extractRoute, /if\s*\(\s*!isMember\b|membership required|记忆.*会员/i);
assert.match(extractRoute, /memory_extract_completed/);
assert.match(read("../migrations/trusted_memory.sql"), /paid or jsonb_array_length\(people\)=0/);
const context = read("../lib/companion-context.ts");
assert.doesNotMatch(context, /if\s*\(\s*!isMember\b/);

// 信件仍然是 Plus 专属。
const letterGeneration = read("../lib/letter-generation.ts");
assert.match(letterGeneration, /plus_required/, "Free accounts must not generate Plus-only letters");

// 客户端不能伪造服务端诊断事件。
assert.equal(isClientProductEventName("chat_opened"), true);
assert.equal(isClientProductEventName("checkout_started"), true);
assert.equal(isClientProductEventName("chat_reply_completed"), false);
assert.equal(isClientProductEventName("memory_extract_completed"), false);
assert.equal(isClientProductEventName("quota_exhausted"), false);
assert.equal(isProductEventName("chat_reply_completed"), true, "Server-side events remain valid");

console.log("\nUnlimited free conversations and feature-entitlement boundary tests passed.");
