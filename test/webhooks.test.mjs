import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  canonicalJson,
  constructEvent,
  isPaidStatus,
  signPayload,
  signPayloadV2,
  signatureFromHeaders,
  signatureV2FromHeaders,
  timestampFromHeaders,
  eventIdFromHeaders,
  verifySignature,
  verifySignatureV2,
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

test("constructEvent refuse une mauvaise signature v1", () => {
  const payload = { payment_id: "abc", payment_status: "waiting" };
  assert.throws(() => constructEvent(payload, "nope", "secret"));
  const event = constructEvent(payload, signPayload(payload, "secret"), "secret");
  assert.equal(event.payment_id, "abc");
});

test("signatureFromHeaders lit x-syli-sig", () => {
  assert.equal(signatureFromHeaders({ "x-syli-sig": "abc" }), "abc");
  assert.equal(signatureFromHeaders(new Headers({ "x-syli-sig": "xyz" })), "xyz");
});

test("isPaidStatus accepte confirmed et l’ancien sending/finished", () => {
  assert.equal(isPaidStatus("confirmed"), true);
  assert.equal(isPaidStatus("sending"), true);
  assert.equal(isPaidStatus("finished"), true);
  assert.equal(isPaidStatus("waiting"), false);
  assert.equal(isPaidStatus("partially_paid"), false);
});

test("v2 HMAC-SHA256 sur timestamp.body brut, comparaison en temps constant", () => {
  const rawBody = '{"payment_id":"abc","actually_paid":20}';
  const timestamp = "1710000000";
  const secret = "whsec_test";
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  assert.equal(signPayloadV2(timestamp, rawBody, secret), expected);
  assert.equal(
    verifySignatureV2(rawBody, secret, expected, timestamp, { nowMs: 1710000000 * 1000 }),
    true,
  );
  assert.equal(
    verifySignatureV2(rawBody, secret, expected, timestamp, { nowMs: (1710000000 + 301) * 1000 }),
    false,
  );
  assert.equal(
    verifySignatureV2(rawBody, secret, expected, timestamp, {
      nowMs: (1710000000 + 400) * 1000,
      toleranceSeconds: 600,
    }),
    true,
  );
});

test("constructEvent v2 sur body brut + headers, fallback v1 si objet parsé", () => {
  const payload = { payment_id: "evt-1", payment_status: "confirmed", actually_paid: 20 };
  const rawBody = JSON.stringify(payload);
  const secret = "whsec_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    "x-syli-sig": signPayload(payload, secret),
    "x-syli-sig-v2": signPayloadV2(timestamp, rawBody, secret),
    "x-syli-timestamp": timestamp,
    "x-syli-event-id": "delivery-uuid-1",
  };
  const event = constructEvent(rawBody, headers, secret);
  assert.equal(event.payment_id, "evt-1");
  assert.equal(eventIdFromHeaders(headers), "delivery-uuid-1");
  assert.equal(signatureV2FromHeaders(headers), headers["x-syli-sig-v2"]);
  assert.equal(timestampFromHeaders(headers), timestamp);

  const parsed = constructEvent(payload, headers["x-syli-sig"], secret);
  assert.equal(parsed.payment_id, "evt-1");

  assert.throws(() =>
    constructEvent(rawBody, { ...headers, "x-syli-sig-v2": "deadbeef" }, secret),
  );
});

test("constructEvent v2 refuse un timestamp hors tolérance", () => {
  const rawBody = '{"payment_id":"abc"}';
  const secret = "whsec_test";
  const timestamp = String(Math.floor(Date.now() / 1000) - 400);
  const headers = {
    "x-syli-sig-v2": signPayloadV2(timestamp, rawBody, secret),
    "x-syli-timestamp": timestamp,
  };
  assert.throws(() => constructEvent(rawBody, headers, secret));
  const event = constructEvent(rawBody, headers, secret, { toleranceSeconds: 600 });
  assert.equal(event.payment_id, "abc");
});
