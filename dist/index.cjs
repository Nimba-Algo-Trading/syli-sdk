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
  Syli: () => Syli,
  SyliError: () => SyliError,
  canonicalJson: () => canonicalJson,
  constructEvent: () => constructEvent,
  isPaidStatus: () => isPaidStatus,
  signPayload: () => signPayload,
  signatureFromHeaders: () => signatureFromHeaders,
  verifySignature: () => verifySignature
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var SyliError = class extends Error {
  status;
  body;
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = "SyliError";
    this.status = status;
    this.body = body;
  }
};

// src/types.ts
var DEFAULT_API_URL = "https://sylipayments.com/api/v1";

// src/webhooks.ts
var import_node_crypto = require("crypto");
function canonicalJson(payload) {
  return JSON.stringify(payload, Object.keys(payload).sort());
}
function signPayload(payload, secret) {
  return (0, import_node_crypto.createHmac)("sha512", secret).update(canonicalJson(payload)).digest("hex");
}
function verifySignature(payload, secret, signature) {
  if (!secret || !signature) return false;
  const expected = signPayload(payload, secret);
  const received = String(signature).toLowerCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return (0, import_node_crypto.timingSafeEqual)(a, b);
}
function signatureFromHeaders(headers) {
  if (typeof headers.get === "function") {
    return headers.get("x-syli-sig") || headers.get("X-Syli-Sig") || "";
  }
  const raw = headers;
  const value = raw["x-syli-sig"] ?? raw["X-Syli-Sig"] ?? raw["X-SYLI-SIG"] ?? "";
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function isPaidStatus(status) {
  const key = String(status ?? "").trim().toLowerCase();
  return key === "confirmed" || key === "finished" || key === "sending";
}
function constructEvent(body, signature, secret) {
  const payload = typeof body === "string" ? JSON.parse(body) : body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SyliError("Webhook SYLI : JSON objet attendu", 400, payload);
  }
  const record = payload;
  if (!verifySignature(record, secret, signature)) {
    throw new SyliError("Webhook SYLI : signature invalide", 401);
  }
  return record;
}

// src/client.ts
function normalizeApiUrl(value) {
  let url = value.trim().replace(/\/+$/, "");
  if (!/\/api\/v1$/i.test(url)) url += "/api/v1";
  return url;
}
var Syli = class {
  apiUrl;
  apiKey;
  timeoutMs;
  constructor(options) {
    if (!options?.apiKey) {
      throw new SyliError("apiKey est requis (syli_live_\u2026)");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? DEFAULT_API_URL);
    this.timeoutMs = options.timeoutMs ?? 3e4;
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
  /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
  verifyWebhook(payload, signature, secret) {
    return verifySignature(payload, secret, signature);
  }
  /**
   * Parse + vérifie un webhook (Express, Next.js, Fastify…).
   * Passez le JSON parsé ou le body texte, et l’en-tête `x-syli-sig`.
   */
  constructEvent(body, signature, secret) {
    return constructEvent(body, signature, secret);
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
      throw new SyliError(message, res.status, json);
    }
    return json;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_API_URL,
  Syli,
  SyliError,
  canonicalJson,
  constructEvent,
  isPaidStatus,
  signPayload,
  signatureFromHeaders,
  verifySignature
});
