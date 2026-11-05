import assert from "node:assert/strict";
import { MEMBERSHIP_PLANS, membershipPlans, membershipTier } from "../lib/membership-plans";
import { canAccessConsoleFeature, limitImportantPeople } from "../lib/access";
import { activeMembershipTier } from "../lib/admin-membership";

const byId = Object.fromEntries(MEMBERSHIP_PLANS.map((plan) => [plan.id, plan]));
assert.equal(byId.plus_monthly.price, 6.99);
assert.equal(byId.plus_yearly.price, 59.99);
assert.equal(byId.premium_monthly.price, 12.99);
assert.equal(byId.premium_yearly.price, 109.99);
assert.equal(byId.plus_trial.price, 0.99);
assert.equal(byId.plus_trial.autoRenew, false);
assert.equal(byId.premium_monthly.available, false);
assert.equal(byId.premium_yearly.available, false);
assert.equal(membershipPlans(false).find((plan) => plan.id === "plus_trial")?.available, false);

assert.equal(membershipTier("monthly"), "plus");
assert.equal(membershipTier("weekly"), "plus");
assert.equal(membershipTier("plus_yearly"), "plus");
assert.equal(membershipTier("premium_monthly"), "premium");
assert.equal(membershipTier("free"), "free");
assert.equal(canAccessConsoleFeature("free", "today"), true);
assert.equal(canAccessConsoleFeature("free", "about"), true);
assert.equal(canAccessConsoleFeature("free", "people"), true);
assert.equal(canAccessConsoleFeature("free", "moments"), false);
assert.equal(canAccessConsoleFeature("free", "dreams"), false);
assert.equal(canAccessConsoleFeature("free", "letters"), false);
assert.equal(canAccessConsoleFeature("free", "insights"), false);
assert.equal(canAccessConsoleFeature("plus", "insights"), true);
assert.equal(canAccessConsoleFeature("premium", "insights"), true);
assert.deepEqual(limitImportantPeople(["A", "B"], "free"), ["A"]);
assert.deepEqual(limitImportantPeople(["A", "B"], "plus"), ["A", "B"]);

const now = new Date("2026-11-05T00:00:00.000Z");
assert.equal(activeMembershipTier({ membership_type: "plus_monthly", membership_expires_at: "2026-12-01T00:00:00.000Z", manual_membership_type: null, manual_membership_expires_at: null }, now), "plus");
assert.equal(activeMembershipTier({ membership_type: "plus_trial", membership_expires_at: "2026-11-01T00:00:00.000Z", manual_membership_type: null, manual_membership_expires_at: null }, now), "free");
assert.equal(activeMembershipTier({ membership_type: "free", membership_expires_at: null, manual_membership_type: "premium_yearly", manual_membership_expires_at: "2027-01-01T00:00:00.000Z" }, now), "premium");

console.log("Relationship membership, pricing, and entitlement tests passed.");
