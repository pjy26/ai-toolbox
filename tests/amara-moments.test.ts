import assert from "node:assert/strict";
import { amaraMomentText } from "../lib/amara-moments";

const legacyZh = amaraMomentText("用户提到最近睡眠很差，陪伴角色表达关心并靠近。", "p", "zh");
assert.equal(legacyZh, "p告诉我最近睡眠很差，我表达关心并靠近。");
assert.ok(!legacyZh.includes("用户"));
assert.ok(!legacyZh.includes("陪伴角色"));

const firstPersonZh = amaraMomentText("p主动对我说“宝宝我爱你”，我也回应了爱意。", "p", "zh");
assert.equal(firstPersonZh, "p主动对我说“宝宝我爱你”，我也回应了爱意。");
assert.ok(!firstPersonZh.startsWith("我记得"));

const legacyEn = amaraMomentText("The user shared a fear; the companion listened.", "Alex", "en");
assert.equal(legacyEn, "Alex shared a fear; I listened.");
assert.ok(!legacyEn.includes("user"));
assert.ok(!legacyEn.includes("companion"));

console.log("✓ Legacy Chinese summaries become Amara’s first-person words without generic prefixes");
console.log("✓ Existing first-person monologues remain unchanged");
console.log("✓ Legacy English role labels use the same first-person rule");
console.log("\n3/3 Amara moment tests passed.");
