export const DEFAULT_API_URL = "https://sylipayments.com/api/v1";

export type PayCurrency =
  | "btc"
  | "eth"
  | "usdterc20"
  | "usdttrc20"
  | "usdtbsc"
  | "usdcerc20"
  | "sol"
  | "bnbbsc"
  | "xrp"
  | "xmr"
  | (string & {});

export type PriceCurrency = "usdt" | "usd" | (string & {});

/** Statut payin renvoyé au marchand. `sending` / `finished` sont mappés en `confirmed`. */
export type PaymentStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "finished"
  | "partially_paid"
  | "expired"
  | "failed"
  | "refunded"
  | (string & {});

export type SyliOptions = {
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

export type CreatePaymentParams = {
  price_amount: number;
  price_currency: PriceCurrency;
  pay_currency: PayCurrency;
  order_id?: string | null;
  order_description?: string | null;
  ipn_callback_url?: string | null;
};

export type Payment = {
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

export type CreateInvoiceParams = {
  price_amount: number;
  price_currency: PriceCurrency;
  pay_currency?: PayCurrency | null;
  order_id?: string | null;
  order_description?: string | null;
  ipn_callback_url?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
};

export type Invoice = {
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

export type CurrencyInfo = {
  code: string;
  label?: string;
  ticker?: string;
  network?: string;
  logo?: string;
};

export type CurrenciesResponse = {
  currencies: string[];
  accepted?: CurrencyInfo[];
  /** Identique à `accepted` (rétrocompat). */
  available?: CurrencyInfo[];
};

export type EstimateParams = {
  amount: number;
  currency_from: string;
  currency_to: string;
};

export type Estimate = {
  currency_from: string;
  amount_from: number;
  currency_to: string;
  estimated_amount: number;
};

export type MinAmountParams = {
  currency_from: string;
  currency_to?: string;
};

export type MinAmount = {
  currency_from: string;
  currency_to: string;
  min_amount: number;
  processor_min_amount?: number;
  fee_usd?: number;
  rule?: string;
};

export type WebhookEvent = {
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
  outcome_currency: string | null;
  payout_amount: number | null;
  payout_hash: string | null;
  payin_hash: string | null;
  payout_status: string | null;
  [key: string]: unknown;
};
