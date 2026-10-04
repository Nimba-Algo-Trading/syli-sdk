import { createHmac, timingSafeEqual } from "node:crypto";
import { SyliError } from "./errors.js";
import type { WebhookEvent } from "./types.js";

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/** Canonicalisation identique au serveur : `JSON.stringify(payload, Object.keys(payload).sort())`. */
export function canonicalJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export function signPayload(payload: Record<string, unknown>, secret: string): string {
  return createHmac("sha512", secret).update(canonicalJson(payload)).digest("hex");
}

/** HMAC-SHA256 hex of `${unixSeconds}.${rawHttpBody}`. */
export function signPayloadV2(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

function timingSafeEqualUtf8(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySignature(
  payload: Record<string, unknown>,
  secret: string,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = signPayload(payload, secret);
  const received = String(signature).toLowerCase();
  return timingSafeEqualUtf8(expected, received);
}

export function verifySignatureV2(
  rawBody: string,
  secret: string,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  options?: { toleranceSeconds?: number; nowMs?: number },
): boolean {
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const tolerance = options?.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  const nowSec = Math.floor((options?.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > tolerance) return false;
  const expected = signPayloadV2(timestamp, rawBody, secret);
  return timingSafeEqualUtf8(expected, String(signature).trim().toLowerCase());
}

function isHeaders(value: unknown): value is Headers {
  return Boolean(value) && typeof (value as Headers).get === "function";
}

function headerLookup(
  headers: Headers | Record<string, string | string[] | undefined | null>,
  name: string,
): string {
  const target = name.toLowerCase();
  if (isHeaders(headers)) {
    return headers.get(name) || headers.get(target) || "";
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] ?? "" : value ?? "";
    }
  }
  return "";
}

export function signatureFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>,
): string {
  return headerLookup(headers, "x-syli-sig");
}

export function signatureV2FromHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>,
): string {
  return headerLookup(headers, "x-syli-sig-v2");
}

export function timestampFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>,
): string {
  return headerLookup(headers, "x-syli-timestamp");
}

export function eventIdFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>,
): string {
  return headerLookup(headers, "x-syli-event-id");
}

function isHeaderMap(
  value: unknown,
): value is Headers | Record<string, string | string[] | undefined | null> {
  if (!value || typeof value !== "object") return false;
  if (isHeaders(value)) return true;
  const keys = Object.keys(value as object);
  return keys.some((key) => key.toLowerCase().startsWith("x-syli-") || key.toLowerCase() === "x-syli-sig");
}

/** Payin client encaissé. `sending` / `finished` restent acceptés (anciens webhooks). */
export function isPaidStatus(status: string | null | undefined): boolean {
  const key = String(status ?? "").trim().toLowerCase();
  return key === "confirmed" || key === "finished" || key === "sending";
}

export type ConstructEventOptions = {
  /** Clock skew for v2, in seconds. Default 300. */
  toleranceSeconds?: number;
  nowMs?: number;
  /** Reject the event if v2 headers are missing (recommended after migration). */
  requireV2?: boolean;
};

/**
 * Parse le JSON et vérifie la signature.
 *
 * v2 (recommandé) : HMAC-SHA256 de `${timestamp}.${bodyBrut}` — passez le body HTTP
 * brut (string) et les en-têtes (`x-syli-sig-v2`, `x-syli-timestamp`).
 * v1 (compat) : HMAC-SHA512 du JSON aux clés triées — 2e argument = `x-syli-sig`.
 *
 * Si v2 est présent avec un body brut et que la vérif échoue, pas de repli v1
 * (anti-downgrade). Si le body est déjà parsé (objet), repli v1.
 */
export function constructEvent(
  body: string | Record<string, unknown>,
  signatureOrHeaders: string | null | undefined | Headers | Record<string, string | string[] | undefined | null>,
  secret: string,
  options?: ConstructEventOptions,
): WebhookEvent {
  const rawBody = typeof body === "string" ? body : null;
  let payload: unknown;
  try {
    payload = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, body);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, payload);
  }
  const record = payload as Record<string, unknown>;

  const headers = isHeaderMap(signatureOrHeaders) ? signatureOrHeaders : null;
  const sigV1 = headers ? signatureFromHeaders(headers) : String(signatureOrHeaders ?? "");
  const sigV2 = headers ? signatureV2FromHeaders(headers) : "";
  const timestamp = headers ? timestampFromHeaders(headers) : "";

  if (options?.requireV2 && (!sigV2 || !timestamp || rawBody == null)) {
    throw new SyliError("Webhook SYLI : signature v2 requise", 401);
  }

  if (sigV2 && rawBody != null) {
    if (!verifySignatureV2(rawBody, secret, sigV2, timestamp, options)) {
      throw new SyliError("Webhook SYLI : signature v2 invalide", 401);
    }
    return record as WebhookEvent;
  }

  if (!verifySignature(record, secret, sigV1)) {
    throw new SyliError("Webhook SYLI : signature invalide", 401);
  }
  return record as WebhookEvent;
}
