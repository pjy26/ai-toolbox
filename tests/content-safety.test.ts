import assert from "node:assert/strict";
import { ScanAction, ScanReasonCode, ScanSemanticStatus, type ScanResult } from "@waffo/pancake-ts";
import { isSafetyServiceDegraded, parseFallbackSafetyDecision } from "../lib/content-safety";

function verdict(reasonCode: ScanReasonCode, semanticStatus: ScanSemanticStatus): ScanResult {
  return {
    action: ScanAction.Review,
    reasonCode,
    semanticStatus,
    matchedCategories: [],
    requestId: "test",
  };
}

assert.equal(isSafetyServiceDegraded(verdict(ScanReasonCode.ServiceDegraded, ScanSemanticStatus.Scored)), true);
assert.equal(isSafetyServiceDegraded(verdict(ScanReasonCode.ReviewRequired, ScanSemanticStatus.ProviderTimeout)), true);
assert.equal(isSafetyServiceDegraded(verdict(ScanReasonCode.ReviewRequired, ScanSemanticStatus.Scored)), false);
assert.equal(parseFallbackSafetyDecision("ALLOW"), "allowed");
assert.equal(parseFallbackSafetyDecision("block"), "blocked");
assert.equal(parseFallbackSafetyDecision("I cannot decide"), "unavailable");

console.log("✓ Waffo degradation is distinguished from a real content review");
console.log("✓ Provider timeout can use the independent safety fallback");
console.log("✓ Explicit reviews remain blocked without fallback");
console.log("✓ Only exact fallback verdicts are accepted");
console.log("\n4/4 content safety tests passed.");
