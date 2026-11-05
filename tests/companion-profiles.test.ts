import assert from "node:assert/strict";
import { chooseActiveCompanionId, normalizeCompanionGender } from "../lib/companions";

assert.equal(normalizeCompanionGender("male"), "male");
assert.equal(normalizeCompanionGender(" MAN "), "male");
assert.equal(normalizeCompanionGender("男"), "male");
assert.equal(normalizeCompanionGender("female"), "female");
assert.equal(normalizeCompanionGender("女"), "female");
assert.equal(normalizeCompanionGender("unknown"), "female");
assert.equal(normalizeCompanionGender(null, "male"), "male");

const profiles = [{ id: "female-id" }, { id: "male-id" }];
assert.equal(chooseActiveCompanionId(profiles, "male-id"), "male-id");
assert.equal(chooseActiveCompanionId(profiles, "someone-elses-id"), "female-id");
assert.equal(chooseActiveCompanionId(profiles, null), "female-id");
assert.equal(chooseActiveCompanionId([], "male-id"), null);

console.log("\n11/11 independent companion profile tests passed.");
