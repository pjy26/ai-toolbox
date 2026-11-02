import assert from "node:assert/strict";
import { isUserScopedMemoryText } from "../lib/memory-reliability";

const accepted = [
  "今天需要休息",
  "用户最近睡得不好",
  "喜欢清淡饮食",
  "I corrected my sleep schedule",
  "I told you that I missed you",
];

const rejected = [
  "用户对陪伴角色表达了爱意",
  "陪伴角色觉得用户在想念自己",
  "用户纠正了陪伴角色保存的旧记忆",
  "她觉得用户还在生气",
  "I told Amara that I loved her",
  "The assistant thinks the user is lonely",
  "The user corrected the earlier memory",
  "用户分享日常后，AI 表示愿意陪伴",
  "用户深夜主动联系，暗示想念，关系亲密",
  "双方通过歌词互动，氛围轻松",
];

for (const text of accepted) {
  assert.equal(isUserScopedMemoryText(text), true, `Should keep user-only fact: ${text}`);
}
for (const text of rejected) {
  assert.equal(isUserScopedMemoryText(text), false, `Should reject companion interaction or inference: ${text}`);
}
assert.equal(isUserScopedMemoryText(""), false);
assert.equal(isUserScopedMemoryText(null), false);

console.log(`✓ ${accepted.length} user-only facts remain eligible`);
console.log(`✓ ${rejected.length} companion interactions, inferences, and memory corrections are rejected`);
console.log("\n2/2 memory scope tests passed.");
