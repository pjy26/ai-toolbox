import test from "node:test";
import assert from "node:assert/strict";
import {
  isFreshQQTimestamp,
  parseAllowedQQOpenIds,
  parseQQIncomingMessage,
  qqEventTurnId,
  signQQCallbackValidation,
  splitQQReply,
  verifyQQCallbackSignature,
} from "../lib/qq-bot";

test("QQ callback validation matches the official Ed25519 example", () => {
  const signature = signQQCallbackValidation(
    "DG5g3B4j9X2KOErG",
    "1725442341",
    "Arq0D5A61EgUu4OxUvOp",
  );
  assert.equal(
    signature,
    "87befc99c42c651b3aac0278e71ada338433ae26fcb24307bdc5ad38c1adc2d01bcfcadc0842edac85e85205028a1132afe09280305f13aa6909ffc2d652c706",
  );
});

test("QQ dispatch verification accepts a valid raw-body signature and rejects changes", () => {
  const secret = "naOC0ocQE3shWLAfffVLB1rhYPG7";
  const timestamp = "1725442341";
  const rawBody = '{ "op": 0,"d": {}, "t": "GATEWAY_EVENT_NAME"}';
  const input = {
    secret,
    timestamp,
    signature: signQQCallbackValidation(secret, timestamp, rawBody),
    rawBody,
  };
  assert.equal(verifyQQCallbackSignature(input), true);
  assert.equal(verifyQQCallbackSignature({ ...input, rawBody: `${input.rawBody} ` }), false);
  assert.equal(verifyQQCallbackSignature({ ...input, signature: "not-hex" }), false);
});

test("QQ timestamps are accepted only inside the replay window", () => {
  assert.equal(isFreshQQTimestamp("1000", 1001), true);
  assert.equal(isFreshQQTimestamp("1000", 1301), false);
  assert.equal(isFreshQQTimestamp("invalid", 1001), false);
});

test("Only supported private and group messages enter the Amara pipeline", () => {
  const c2c = parseQQIncomingMessage({
    id: "event-1",
    op: 0,
    t: "C2C_MESSAGE_CREATE",
    d: { id: "message-1", content: " 你好 ", author: { user_openid: "user-openid" } },
  });
  assert.deepEqual(c2c, {
    eventId: "event-1",
    messageId: "message-1",
    authorOpenId: "user-openid",
    targetOpenId: "user-openid",
    kind: "c2c",
    content: "你好",
  });
  const group = parseQQIncomingMessage({
    op: 0,
    t: "GROUP_AT_MESSAGE_CREATE",
    d: { id: "message-2", group_openid: "group-openid", author: { user_openid: "user-openid" } },
  });
  assert.equal(group?.kind, "group");
  assert.equal(group?.targetOpenId, "group-openid");
  assert.equal(parseQQIncomingMessage({ op: 0, t: "FRIEND_ADD", d: {} }), null);
});

test("QQ retries map to one valid deterministic turn ID", () => {
  const first = qqEventTurnId("event-1");
  assert.equal(first, qqEventTurnId("event-1"));
  assert.notEqual(first, qqEventTurnId("event-2"));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("QQ allowlists and bounded reply chunks preserve authorization and platform limits", () => {
  assert.deepEqual([...parseAllowedQQOpenIds(" one, two ,,three ")], ["one", "two", "three"]);
  assert.equal(parseAllowedQQOpenIds(undefined).size, 0);
  assert.deepEqual(splitQQReply(" 你好 "), ["你好"]);
  assert.equal(splitQQReply("x".repeat(3200)).length, 3);
  assert.equal(splitQQReply("x".repeat(9000)).length, 4);
  assert.ok(splitQQReply("x".repeat(9000)).every((chunk) => chunk.length <= 1500));
});
