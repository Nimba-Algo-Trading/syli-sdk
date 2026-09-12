declare const DEFAULT_API_URL = "https://sylipayments.com/api/v1";
type PayCurrency = "btc" | "eth" | "usdterc20" | "usdttrc20" | "usdtbsc" | "usdcerc20" | "sol" | "bnbbsc" | "xrp" | "xmr" | (string & {});
type PriceCurrency = "usdt" | "usd" | (string & {});
/** Statut payin renvoyé au marchand. `sending` / `finished` sont mappés en `confirmed`. */
type PaymentStatus = "waiting" | "confirming" | "confirmed" | "sending" | "finished" | "partially_paid" | "expired" | "failed" | "refunded" | (string & {});
type SyliOptions = {
    /** Clé secrète `syli_live_…` (Configuration → API paiement). */
    apiKey: string;
    /**
     * Base URL, avec ou sans `/api/v1`.
     * Défaut : `https://sylipayments.com/api/v1`
     */
    apiUrl?: string;
    /** Timeout HTTP en ms. Défaut : 30 000. */
    timeoutMs?: number;
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
    payment_id: string;
    payment_status: PaymentStatus;
    pay_address: string | null;
    payin_extra_id: string | null;
    price_amount: number;
    price_currency: string;
    pay_amount: number | null;
    actually_paid: number | null;
    pay_currency: string;
    order_id: string | null;
    order_description: string | null;
    invoice_id: string | null;
    outcome_amount: number | null;
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
    pay_currency: string;
    order_id: string | null;
    order_description: string | null;
    outcome_amount: number | null;
    outcome_currency: string | null;
    payout_amount: number | null;
    payout_hash: string | null;
    payin_hash: string | null;
    payout_status: string | null;
    [key: string]: unknown;
};

declare class Syli {
    readonly apiUrl: string;
    readonly apiKey: string;
    readonly timeoutMs: number;
    constructor(options: SyliOptions);
    createPayment(body: CreatePaymentParams): Promise<Payment>;
    getPayment(id: string): Promise<Payment>;
    createInvoice(body: CreateInvoiceParams): Promise<Invoice>;
    getInvoice(id: string): Promise<Invoice>;
    getCurrencies(): Promise<CurrenciesResponse>;
    getStatus(): Promise<{
        message: string;
    }>;
    estimate(params: EstimateParams): Promise<Estimate>;
    getMinAmount(params: MinAmountParams): Promise<MinAmount>;
    /** Vérifie l’en-tête `x-syli-sig` d’un webhook. */
    verifyWebhook(payload: Record<string, unknown>, signature: string | null | undefined, secret: string): boolean;
    /**
     * Parse + vérifie un webhook (Express, Next.js, Fastify…).
     * Passez le JSON parsé ou le body texte, et l’en-tête `x-syli-sig`.
     */
    constructEvent(body: string | Record<string, unknown>, signature: string | null | undefined, secret: string): WebhookEvent;
    signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
    private request;
}

declare class SyliError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status?: number, body?: unknown);
}

/** Canonicalisation identique au serveur : `JSON.stringify(payload, Object.keys(payload).sort())`. */
declare function canonicalJson(payload: Record<string, unknown>): string;
declare function signPayload(payload: Record<string, unknown>, secret: string): string;
declare function verifySignature(payload: Record<string, unknown>, secret: string, signature: string | null | undefined): boolean;
declare function signatureFromHeaders(headers: Headers | Record<string, string | string[] | undefined | null>): string;
/**
 * Parse le JSON, vérifie `x-syli-sig`, et renvoie l’événement.
 * Ne signez jamais le body HTTP brut : le HMAC porte sur l’objet JSON aux clés triées.
 */
declare function constructEvent(body: string | Record<string, unknown>, signature: string | null | undefined, secret: string): WebhookEvent;

export { type CreateInvoiceParams, type CreatePaymentParams, type CurrenciesResponse, type CurrencyInfo, DEFAULT_API_URL, type Estimate, type EstimateParams, type Invoice, type MinAmount, type MinAmountParams, type PayCurrency, type Payment, type PaymentStatus, type PriceCurrency, Syli, SyliError, type SyliOptions, type WebhookEvent, canonicalJson, constructEvent, signPayload, signatureFromHeaders, verifySignature };
