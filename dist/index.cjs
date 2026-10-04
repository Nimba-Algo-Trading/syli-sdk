"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_API_URL: () => DEFAULT_API_URL,
  DEFAULT_API_VERSION: () => DEFAULT_API_VERSION,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS: () => DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  Syli: () => Syli,
  SyliError: () => SyliError,
  canonicalJson: () => canonicalJson,
  constructEvent: () => constructEvent,
  eventIdFromHeaders: () => eventIdFromHeaders,
  isPaidStatus: () => isPaidStatus,
  signPayload: () => signPayload,
  signPayloadV2: () => signPayloadV2,
  signatureFromHeaders: () => signatureFromHeaders,
  signatureV2FromHeaders: () => signatureV2FromHeaders,
  timestampFromHeaders: () => timestampFromHeaders,
  verifySignature: () => verifySignature,
  verifySignatureV2: () => verifySignatureV2
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var SyliError = class extends Error {
  status;
  body;
  code;
  constructor(message, status = 0, body = null, code) {
    super(message);
    this.name = "SyliError";
    this.status = status;
    this.body = body;
    this.code = code ?? (body && typeof body === "object" && !Array.isArray(body) && "code" in body ? String(body.code ?? "") || null : null);
  }
};

// src/types.ts
var DEFAULT_API_URL = "https://api.sylipayments.com/v1";
var DEFAULT_API_VERSION = "2026-10";

// src/webhooks.ts
var import_node_crypto = require("crypto");
var DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
function canonicalJson(payload) {
  return JSON.stringify(payload, Object.keys(payload).sort());
}
function signPayload(payload, secret) {
  return (0, import_node_crypto.createHmac)("sha512", secret).update(canonicalJson(payload)).digest("hex");
}
function signPayloadV2(timestamp, rawBody, secret) {
  return (0, import_node_crypto.createHmac)("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}
function timingSafeEqualUtf8(expected, received) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return (0, import_node_crypto.timingSafeEqual)(a, b);
}
function verifySignature(payload, secret, signature) {
  if (!secret || !signature) return false;
  const expected = signPayload(payload, secret);
  const received = String(signature).toLowerCase();
  return timingSafeEqualUtf8(expected, received);
}
function verifySignatureV2(rawBody, secret, signature, timestamp, options) {
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const tolerance = options?.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  const nowSec = Math.floor((options?.nowMs ?? Date.now()) / 1e3);
  if (Math.abs(nowSec - Number(timestamp)) > tolerance) return false;
  const expected = signPayloadV2(timestamp, rawBody, secret);
  return timingSafeEqualUtf8(expected, String(signature).trim().toLowerCase());
}
function isHeaders(value) {
  return Boolean(value) && typeof value.get === "function";
}
function headerLookup(headers, name) {
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
function signatureFromHeaders(headers) {
  return headerLookup(headers, "x-syli-sig");
}
function signatureV2FromHeaders(headers) {
  return headerLookup(headers, "x-syli-sig-v2");
}
function timestampFromHeaders(headers) {
  return headerLookup(headers, "x-syli-timestamp");
}
function eventIdFromHeaders(headers) {
  return headerLookup(headers, "x-syli-event-id");
}
function isHeaderMap(value) {
  if (!value || typeof value !== "object") return false;
  if (isHeaders(value)) return true;
  const keys = Object.keys(value);
  return keys.some((key) => key.toLowerCase().startsWith("x-syli-") || key.toLowerCase() === "x-syli-sig");
}
function isPaidStatus(status) {
  const key = String(status ?? "").trim().toLowerCase();
  return key === "confirmed" || key === "finished" || key === "sending";
}
function constructEvent(body, signatureOrHeaders, secret, options) {
  const rawBody = typeof body === "string" ? body : null;
  let payload;
  try {
    payload = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, body);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, payload);
  }
  const record = payload;
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
    return record;
  }
  if (!verifySignature(record, secret, sigV1)) {
    throw new SyliError("Webhook SYLI : signature invalide", 401);
  }
  return record;
}

// src/client.ts
function normalizeApiUrl(value) {
  const raw = value.trim().replace(/\/+$/, "");
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    if (host === "api.sylipayments.com" || host === "www.api.sylipayments.com") {
      return `${u.origin}/v1`;
    }
    return `${u.origin}/api/v1`;
  } catch {
    if (/\/api\/v1$/i.test(raw) || /\/v1$/i.test(raw)) return raw;
    return `${raw}/api/v1`;
  }
}
var Syli = class {
  apiUrl;
  apiKey;
  timeoutMs;
  apiVersion;
  constructor(options) {
    if (!options?.apiKey) {
      throw new SyliError("apiKey est requis (syli_live_\u2026 ou syli_test_\u2026)");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? DEFAULT_API_URL);
    this.timeoutMs = options.timeoutMs ?? 3e4;
    this.apiVersion = options.apiVersion === void 0 ? DEFAULT_API_VERSION : options.apiVersion;
  }
  createPayment(body) {
    return this.request("POST", "/payment", body);
  }
  /** Statut du payin. UUID paiement ou facture. */
  getPayment(id) {
    return this.request("GET", `/payment/${encodeURIComponent(id)}`);
  }
  createInvoice(body) {
    return this.request("POST", "/invoice", body);
  }
  /** Statut du payin. Même objet que getPayment ; id facture ou paiement. */
  getInvoice(id) {
    return this.request("GET", `/invoice/${encodeURIComponent(id)}`);
  }
  getCurrencies() {
    return this.request("GET", "/currencies");
  }
  getStatus() {
    return this.request("GET", "/status", void 0, false);
  }
  estimate(params) {
    const query = new URLSearchParams({
      amount: String(params.amount),
      currency_from: params.currency_from,
      currency_to: params.currency_to
    });
    return this.request("GET", `/estimate?${query}`, void 0, false);
  }
  getMinAmount(params) {
    const query = new URLSearchParams({ currency_from: params.currency_from });
    if (params.currency_to) query.set("currency_to", params.currency_to);
    return this.request("GET", `/min-amount?${query}`, void 0, false);
  }
  /** Sandbox : simule un payin (clé syli_test_ uniquement). */
  simulatePayment(id, outcome = "paid") {
    return this.request("POST", `/payment/${encodeURIComponent(id)}/simulate`, { outcome });
  }
  /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
  verifyWebhook(payload, signature, secret) {
    return verifySignature(payload, secret, signature);
  }
  /**
   * Parse + vérifie un webhook (Express, Next.js, Fastify…).
   * v2 : passez le body brut (string) et l’objet headers.
   * v1 : JSON parsé + `x-syli-sig` (compat).
   */
  constructEvent(body, signatureOrHeaders, secret, options) {
    return constructEvent(body, signatureOrHeaders, secret, options);
  }
  signatureFromHeaders(headers) {
    return signatureFromHeaders(headers);
  }
  /** Payin client encaissé. `sending` / `finished` restent acceptés (anciens webhooks). */
  isPaidStatus(status) {
    return isPaidStatus(status);
  }
  async request(method, path, body, auth = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = { accept: "application/json" };
    if (auth) headers["x-api-key"] = this.apiKey;
    if (this.apiVersion) headers["x-syli-api-version"] = this.apiVersion;
    if (body !== void 0) headers["content-type"] = "application/json";
    let res;
    try {
      res = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new SyliError(aborted ? "D\xE9lai d\xE9pass\xE9 (SYLI unreachable)" : "SYLI unreachable");
    } finally {
      clearTimeout(timer);
    }
    const raw = await res.text();
    let json = null;
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        throw new SyliError("R\xE9ponse SYLI invalide", res.status, raw);
      }
    }
    const record = json && typeof json === "object" ? json : null;
    if (!res.ok || record?.status === false) {
      const message = String(record?.message ?? record?.error ?? `Erreur SYLI (${res.status})`);
      const code = typeof record?.code === "string" ? record.code : null;
      throw new SyliError(message, res.status, json, code);
    }
    return json;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_API_URL,
  DEFAULT_API_VERSION,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  Syli,
  SyliError,
  canonicalJson,
  constructEvent,
  eventIdFromHeaders,
  isPaidStatus,
  signPayload,
  signPayloadV2,
  signatureFromHeaders,
  signatureV2FromHeaders,
  timestampFromHeaders,
  verifySignature,
  verifySignatureV2
});
