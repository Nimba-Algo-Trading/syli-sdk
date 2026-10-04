declare const DEFAULT_API_URL = "https://api.sylipayments.com/v1";
declare const DEFAULT_API_VERSION = "2026-10";
type PayCurrency = "btc" | "eth" | "usdterc20" | "usdttrc20" | "usdtbsc" | "usdcerc20" | "sol" | "bnbbsc" | "xrp" | "xmr" | (string & {});
type PriceCurrency = "usdt" | "usd" | (string & {});
/** Statut payin renvoyé au marchand. `sending` / `finished` sont mappés en `confirmed`. */
type PaymentStatus = "waiting" | "confirming" | "confirmed" | "sending" | "finished" | "partially_paid" | "expired" | "failed" | "refunded" | (string & {});
type SyliOptions = {
    /** Clé secrète `syli_live_…` (Configuration → Clés API). */
    apiKey: string;
    /**
     * Base URL. Défaut : `https://api.sylipayments.com/v1`
     * (`https://sylipayments.com/api/v1` reste valide).
     */
    apiUrl?: string;
    /** Timeout HTTP en ms. Défaut : 30 000. */
    timeoutMs?: number;
    /**
     * En-tête x-syli-api-version. Défaut : 2026-10 (401 sur clé invalide).
     * Passez une chaîne vide pour le 503 historique jusqu’au 2027-04-02.
     */
    apiVersion?: string;
};
type CreatePaymentParams = {
    price_amount: number;
    price_currency: PriceCurrency;
    pay_currency: PayCurrency;
    order_id?: string | null;
    order_description?: string | null;
    ipn_callback_url?: string | null;
};
type Payment = {
    payment_id: string | null;
    payment_status: PaymentStatus;
    pay_address: string | null;
    payin_extra_id: string | null;
    price_amount: number;
    price_currency: string;
    pay_amount: number | null;
    actually_paid: number | null;
    actually_paid_usd: number | null;
    pay_currency: string | null;
    order_id: string | null;
    order_description: string | null;
    invoice_id: string | null;
    invoice_url: string;
    outcome_amount: number | null;
    received_amount?: number | null;
    outcome_currency: string | null;
    payout_address: string | null;
    payout_amount: number | null;
    payout_status: string | null;
    payout_hash: string | null;
    payin_hash: string | null;
    created_at: string;
    updated_at: string;
    expiration_estimate_date: string | null;
    rate_locked_at: string | null;
    /** false = clé syli_test_ / paiement simulé. */
    livemode?: boolean;
};
type CreateInvoiceParams = {
    price_amount: number;
    price_currency: PriceCurrency;
    pay_currency?: PayCurrency | null;
    order_id?: string | null;
    order_description?: string | null;
    ipn_callback_url?: string | null;
    success_url?: string | null;
    cancel_url?: string | null;
};
type Invoice = {
    id: string;
    order_id: string | null;
    order_description: string | null;
    price_amount: number;
    price_currency: string;
    pay_currency: string | null;
    ipn_callback_url: string | null;
    success_url: string | null;
    cancel_url: string | null;
    created_at: string;
    invoice_url: string;
    livemode?: boolean;
};
type CurrencyInfo = {
    code: string;
    label?: string;
    ticker?: string;
    network?: string;
    logo?: string;
};
type CurrenciesResponse = {
    currencies: string[];
    accepted?: CurrencyInfo[];
    /** Identique à `accepted` (rétrocompat). */
    available?: CurrencyInfo[];
};
type EstimateParams = {
    amount: number;
    currency_from: string;
    currency_to: string;
};
type Estimate = {
    currency_from: string;
    amount_from: number;
    currency_to: string;
    estimated_amount: number;
};
type MinAmountParams = {
    currency_from: string;
    currency_to?: string;
};
type MinAmount = {
    currency_from: string;
    currency_to: string;
    min_amount: number;
    processor_min_amount?: number;
    fee_usd?: number;
    rule?: string;
};
type WebhookEvent = {
    payment_id: string;
    invoice_id: string | null;
    payment_status: PaymentStatus;
    pay_address: string | null;
    price_amount: number;
    price_currency: string;
    pay_amount: number | null;
    actually_paid: number | null;
    actually_paid_usd: number | null;
    pay_currency: string;
    order_id: string | null;
    order_description: string | null;
    outcome_amount: number | null;
    received_amount?: number | null;
    outcome_currency: string | null;
    payout_amount: number | null;
    payout_hash: string | null;
    payin_hash: string | null;
    payout_status: string | null;
    livemode?: boolean;
    [key: string]: unknown;
};

declare const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
/** Canonicalisation identique au serveur : `JSON.stringify(payload, Object.keys(payload).sort())`. */
declare function canonicalJson(payload: Record<string, unknown>): string;
declare function signPayload(payload: Record<string, unknown>, secret: string): string;
/** HMAC-SHA256 hex of `${unixSeconds}.${rawHttpBody}`. */
declare function signPayloadV2(timestamp: string, rawBody: string, secret: string): string;
declare function verifySignature(payload: Record<string, unknown>, secret: string, signature: string | null | undefined): boolean;
declare function verifySignatureV2(rawBody: string, secret: string, signature: string | null | undefined, timestamp: string | null | undefined, options?: {
    toleranceSeconds?: number;
    nowMs?: number;
}): boolean;
declare function signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
declare function signatureV2FromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
declare function timestampFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
declare function eventIdFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
/** Payin client encaissé. `sending` / `finished` restent acceptés (anciens webhooks). */
declare function isPaidStatus(status: string | null | undefined): boolean;
type ConstructEventOptions = {
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
declare function constructEvent(body: string | Record<string, unknown>, signatureOrHeaders: string | null | undefined | Headers | Record<string, string | string[] | undefined | null>, secret: string, options?: ConstructEventOptions): WebhookEvent;

declare class Syli {
    readonly apiUrl: string;
    readonly apiKey: string;
    readonly timeoutMs: number;
    readonly apiVersion: string;
    constructor(options: SyliOptions);
    createPayment(body: CreatePaymentParams): Promise<Payment>;
    /** Statut du payin. UUID paiement ou facture. */
    getPayment(id: string): Promise<Payment>;
    createInvoice(body: CreateInvoiceParams): Promise<Invoice>;
    /** Statut du payin. Même objet que getPayment ; id facture ou paiement. */
    getInvoice(id: string): Promise<Payment>;
    getCurrencies(): Promise<CurrenciesResponse>;
    getStatus(): Promise<{
        message: string;
    }>;
    estimate(params: EstimateParams): Promise<Estimate>;
    getMinAmount(params: MinAmountParams): Promise<MinAmount>;
    /** Sandbox : simule un payin (clé syli_test_ uniquement). */
    simulatePayment(id: string, outcome?: "paid" | "partially_paid" | "expired"): Promise<Payment>;
    /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
    verifyWebhook(payload: Record<string, unknown>, signature: string | null | undefined, secret: string): boolean;
    /**
     * Parse + vérifie un webhook (Express, Next.js, Fastify…).
     * v2 : passez le body brut (string) et l’objet headers.
     * v1 : JSON parsé + `x-syli-sig` (compat).
     */
    constructEvent(body: string | Record<string, unknown>, signatureOrHeaders: string | null | undefined | Headers | Record<string, string | string[] | undefined | null>, secret: string, options?: ConstructEventOptions): WebhookEvent;
    signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
    /** Payin client encaissé. `sending` / `finished` restent acceptés (anciens webhooks). */
    isPaidStatus(status: string | null | undefined): boolean;
    private request;
}

declare class SyliError extends Error {
    readonly status: number;
    readonly body: unknown;
    readonly code: string | null;
    constructor(message: string, status?: number, body?: unknown, code?: string | null);
}

export { type ConstructEventOptions, type CreateInvoiceParams, type CreatePaymentParams, type CurrenciesResponse, type CurrencyInfo, DEFAULT_API_URL, DEFAULT_API_VERSION, DEFAULT_WEBHOOK_TOLERANCE_SECONDS, type Estimate, type EstimateParams, type Invoice, type MinAmount, type MinAmountParams, type PayCurrency, type Payment, type PaymentStatus, type PriceCurrency, Syli, SyliError, type SyliOptions, type WebhookEvent, canonicalJson, constructEvent, eventIdFromHeaders, isPaidStatus, signPayload, signPayloadV2, signatureFromHeaders, signatureV2FromHeaders, timestampFromHeaders, verifySignature, verifySignatureV2 };
