import assert from "node:assert/strict";
import { displayMemoryText } from "../lib/memory-display";

assert.equal(displayMemoryText("name: 潘佳熠", "zh"), "名字 · 潘佳熠");
assert.equal(displayMemoryText("gender: male", "zh"), "性别 · 男性");
assert.equal(displayMemoryText("food: Noodles", "en"), "Favorite food · Noodles");
assert.equal(displayMemoryText("I like quiet weekends", "zh"), "I like quiet weekends");

console.log("✓ Profile keys and common values are localized for the console");
console.log("✓ Natural-language memory summaries remain unchanged");
console.log("\n2/2 memory display tests passed.");
