import { SyliError } from "./errors.js";
import { DEFAULT_API_URL, type SyliOptions } from "./types.js";
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
import { constructEvent, signatureFromHeaders, verifySignature } from "./webhooks.js";

function normalizeApiUrl(value: string): string {
  let url = value.trim().replace(/\/+$/, "");
  if (!/\/api\/v1$/i.test(url)) url += "/api/v1";
  return url;
}

export class Syli {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;

  constructor(options: SyliOptions) {
    if (!options?.apiKey) {
      throw new SyliError("apiKey est requis (syli_live_…)");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? DEFAULT_API_URL);
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  createPayment(body: CreatePaymentParams): Promise<Payment> {
    return this.request("POST", "/payment", body);
  }

  getPayment(id: string): Promise<Payment> {
    return this.request("GET", `/payment/${encodeURIComponent(id)}`);
  }

  createInvoice(body: CreateInvoiceParams): Promise<Invoice> {
    return this.request("POST", "/invoice", body);
  }

  getInvoice(id: string): Promise<Invoice> {
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

  /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
  verifyWebhook(payload: Record<string, unknown>, signature: string | null | undefined, secret: string): boolean {
    return verifySignature(payload, secret, signature);
  }

  /**
   * Parse + vérifie un webhook (Express, Next.js, Fastify…).
   * Passez le JSON parsé ou le body texte, et l’en-tête `x-syli-sig`.
   */
  constructEvent(
    body: string | Record<string, unknown>,
    signature: string | null | undefined,
    secret: string,
  ) {
    return constructEvent(body, signature, secret);
  }

  signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>) {
    return signatureFromHeaders(headers);
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
      throw new SyliError(message, res.status, json);
    }
    return json as T;
  }
}
