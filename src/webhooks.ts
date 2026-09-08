import { createHmac, timingSafeEqual } from "node:crypto";
import { SyliError } from "./errors.js";
import type { WebhookEvent } from "./types.js";

/** Canonicalisation identique au serveur : `JSON.stringify(payload, Object.keys(payload).sort())`. */
export function canonicalJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export function signPayload(payload: Record<string, unknown>, secret: string): string {
  return createHmac("sha512", secret).update(canonicalJson(payload)).digest("hex");
}

export function verifySignature(
  payload: Record<string, unknown>,
  secret: string,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = signPayload(payload, secret);
  const received = String(signature).toLowerCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signatureFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>,
): string {
  if (typeof (headers as Headers).get === "function") {
    return (
      (headers as Headers).get("x-syli-sig") ||
      (headers as Headers).get("X-Syli-Sig") ||
      ""
    );
  }
  const raw = headers as Record<string, string | string[] | undefined | null>;
  const value = raw["x-syli-sig"] ?? raw["X-Syli-Sig"] ?? raw["X-SYLI-SIG"] ?? "";
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

/**
 * Parse le JSON, vérifie `x-syli-sig`, et renvoie l’événement.
 * Ne signez jamais le body HTTP brut : le HMAC porte sur l’objet JSON aux clés triées.
 */
export function constructEvent(
  body: string | Record<string, unknown>,
  signature: string | null | undefined,
  secret: string,
): WebhookEvent {
  const payload = typeof body === "string" ? (JSON.parse(body) as unknown) : body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, payload);
  }
  const record = payload as Record<string, unknown>;
  if (!verifySignature(record, secret, signature)) {
    throw new SyliError("Webhook SYLI : signature invalide", 401);
  }
  return record as WebhookEvent;
}
