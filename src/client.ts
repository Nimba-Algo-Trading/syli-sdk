import { SyliError } from "./errors.js";
import { DEFAULT_API_URL, DEFAULT_API_VERSION, type SyliOptions } from "./types.js";
import type {
  CreateInvoiceParams,
  CreatePaymentParams,
  CurrenciesResponse,
  Estimate,
  EstimateParams,
  Invoice,
  MinAmount,
  MinAmountParams,
  Payment,
} from "./types.js";
import { constructEvent, isPaidStatus as checkPaidStatus, signatureFromHeaders, verifySignature, type ConstructEventOptions } from "./webhooks.js";

function normalizeApiUrl(value: string): string {
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

export class Syli {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly apiVersion: string;

  constructor(options: SyliOptions) {
    if (!options?.apiKey) {
      throw new SyliError("apiKey est requis (syli_live_… ou syli_test_…)");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? DEFAULT_API_URL);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.apiVersion = options.apiVersion === undefined ? DEFAULT_API_VERSION : options.apiVersion;
  }

  createPayment(body: CreatePaymentParams): Promise<Payment> {
    return this.request("POST", "/payment", body);
  }

  /** Statut du payin. UUID paiement ou facture. */
  getPayment(id: string): Promise<Payment> {
    return this.request("GET", `/payment/${encodeURIComponent(id)}`);
  }

  createInvoice(body: CreateInvoiceParams): Promise<Invoice> {
    return this.request("POST", "/invoice", body);
  }

  /** Statut du payin. Même objet que getPayment ; id facture ou paiement. */
  getInvoice(id: string): Promise<Payment> {
    return this.request("GET", `/invoice/${encodeURIComponent(id)}`);
  }

  getCurrencies(): Promise<CurrenciesResponse> {
    return this.request("GET", "/currencies");
  }

  getStatus(): Promise<{ message: string }> {
    return this.request("GET", "/status", undefined, false);
  }

  estimate(params: EstimateParams): Promise<Estimate> {
    const query = new URLSearchParams({
      amount: String(params.amount),
      currency_from: params.currency_from,
      currency_to: params.currency_to,
    });
    return this.request("GET", `/estimate?${query}`, undefined, false);
  }

  getMinAmount(params: MinAmountParams): Promise<MinAmount> {
    const query = new URLSearchParams({ currency_from: params.currency_from });
    if (params.currency_to) query.set("currency_to", params.currency_to);
    return this.request("GET", `/min-amount?${query}`, undefined, false);
  }

  /** Sandbox : simule un payin (clé syli_test_ uniquement). */
  simulatePayment(id: string, outcome: "paid" | "partially_paid" | "expired" = "paid"): Promise<Payment> {
    return this.request("POST", `/payment/${encodeURIComponent(id)}/simulate`, { outcome });
  }

  /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
  verifyWebhook(payload: Record<string, unknown>, signature: string | null | undefined, secret: string): boolean {
    return verifySignature(payload, secret, signature);
  }

  /**
   * Parse + vérifie un webhook (Express, Next.js, Fastify…).
   * v2 : passez le body brut (string) et l’objet headers.
   * v1 : JSON parsé + `x-syli-sig` (compat).
   */
  constructEvent(
    body: string | Record<string, unknown>,
    signatureOrHeaders: string | null | undefined | Headers | Record<string, string | string[] | undefined | null>,
    secret: string,
    options?: ConstructEventOptions,
  ) {
    return constructEvent(body, signatureOrHeaders, secret, options);
  }

  signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>) {
    return signatureFromHeaders(headers);
  }

  /** Payin client encaissé. `sending` / `finished` restent acceptés (anciens webhooks). */
  isPaidStatus(status: string | null | undefined): boolean {
    return checkPaidStatus(status);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = { accept: "application/json" };
    if (auth) headers["x-api-key"] = this.apiKey;
    if (this.apiVersion) headers["x-syli-api-version"] = this.apiVersion;
    if (body !== undefined) headers["content-type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new SyliError(aborted ? "Délai dépassé (SYLI unreachable)" : "SYLI unreachable");
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    let json: unknown = null;
    if (raw) {
      try {
        json = JSON.parse(raw) as unknown;
      } catch {
        throw new SyliError("Réponse SYLI invalide", res.status, raw);
      }
    }

    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    if (!res.ok || record?.status === false) {
      const message = String(record?.message ?? record?.error ?? `Erreur SYLI (${res.status})`);
      const code = typeof record?.code === "string" ? record.code : null;
      throw new SyliError(message, res.status, json, code);
    }
    return json as T;
  }
}
