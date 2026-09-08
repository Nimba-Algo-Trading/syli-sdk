import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  canonicalJson,
  constructEvent,
  signPayload,
  signatureFromHeaders,
  verifySignature,
} from "../dist/index.js";

test("canonical JSON trie les clés de premier niveau", () => {
  const payload = { z: 1, a: 2, m: "ok" };
  assert.equal(canonicalJson(payload), JSON.stringify(payload, Object.keys(payload).sort()));
  assert.equal(canonicalJson(payload), '{"a":2,"m":"ok","z":1}');
});

test("HMAC-SHA512 identique à l’implémentation serveur", () => {
  const payload = {
    payment_id: "abc",
    payment_status: "finished",
    order_id: "CMD-1",
    actually_paid: 20,
  };
  const secret = "whsec_test";
  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest("hex");
  assert.equal(signPayload(payload, secret), expected);
  assert.equal(verifySignature(payload, secret, expected), true);
  assert.equal(verifySignature(payload, secret, expected.toUpperCase()), true);
  assert.equal(verifySignature(payload, secret, "deadbeef"), false);
});

test("constructEvent refuse une mauvaise signature", () => {
  const payload = { payment_id: "abc", payment_status: "waiting" };
  assert.throws(() => constructEvent(payload, "nope", "secret"));
  const event = constructEvent(payload, signPayload(payload, "secret"), "secret");
  assert.equal(event.payment_id, "abc");
});

test("signatureFromHeaders lit x-syli-sig", () => {
  assert.equal(signatureFromHeaders({ "x-syli-sig": "abc" }), "abc");
  assert.equal(signatureFromHeaders(new Headers({ "x-syli-sig": "xyz" })), "xyz");
});
