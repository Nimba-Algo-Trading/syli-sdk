# SDK JavaScript SYLI

Client Node.js (≥ 18) pour l’API [SYLI](https://sylipayments.com) : paiements crypto, checkout hébergé, et vérification des webhooks (`x-syli-sig`).

Dépôt : [Nimba-Algo-Trading/syli-sdk](https://github.com/Nimba-Algo-Trading/syli-sdk)

> Serveur uniquement : la clé `syli_live_…` ne doit jamais partir dans le navigateur.

## Installation

Depuis npm :

```bash
npm install syli-sdk
```

Depuis ce dépôt GitHub (`dist` déjà compilé, aucune dépendance à installer) :

```bash
npm install github:Nimba-Algo-Trading/syli-sdk
```

## Usage

```js
import { Syli } from "syli-sdk";

const syli = new Syli({
  apiKey: process.env.SYLI_API_KEY,
  // apiUrl: "https://api.sylipayments.com/v1", // défaut
});

const invoice = await syli.createInvoice({
  price_amount: 49.9,
  price_currency: "usdt",
  order_id: "CMD-9001",
  success_url: "https://boutique.example/ok",
  cancel_url: "https://boutique.example/annuler",
  ipn_callback_url: "https://boutique.example/webhooks/syli",
});

// Redirigez le client vers le checkout SYLI
console.log(invoice.invoice_url);
```

Paiement API (vous affichez l’adresse et le QR) :

```js
const payment = await syli.createPayment({
  price_amount: 20,
  price_currency: "usdt",
  pay_currency: "usdttrc20",
  order_id: "CMD-4821",
  order_description: "Abonnement mensuel",
});

console.log(payment.pay_address, payment.payin_extra_id);
if (payment.payment_id) {
  const latest = await syli.getPayment(payment.payment_id);
}
const status = await syli.getInvoice(invoice.id);
// status.payment_status, status.actually_paid, status.actually_paid_usd
```

Utilitaires :

```js
await syli.getStatus();
await syli.getCurrencies(); // cryptos du compte (wallet validé, clé envoyée)
await syli.estimate({ amount: 20, currency_from: "usdt", currency_to: "btc" });
await syli.getMinAmount({ currency_from: "usdt", currency_to: "btc" });
await syli.simulatePayment(payment.payment_id, "paid"); // clé syli_test_ uniquement
```

CommonJS :

```js
const { Syli } = require("syli-sdk");
```

## Webhooks

Recommandé (v2) : `x-syli-sig-v2` = HMAC-SHA256 de `` `${timestamp}.${rawBody}` ``, plus `x-syli-timestamp`. Conservé (v1) : `x-syli-sig` = HMAC-SHA512 du JSON aux clés triées. Répondez **2xx**. Dédoublonnez sur `payment_id` ; livrez à la première transition vers `confirmed`.

Express (body brut) :

```js
import express from "express";
import { Syli, SyliError } from "syli-sdk";

const syli = new Syli({ apiKey: process.env.SYLI_API_KEY });
const app = express();
app.use(express.raw({ type: "application/json" }));

app.post("/webhooks/syli", (req, res) => {
  try {
    const event = syli.constructEvent(
      req.body.toString("utf8"),
      req.headers,
      process.env.SYLI_IPN_SECRET,
    );
    if (syli.isPaidStatus(event.payment_status)) {
      // marquer event.order_id une seule fois
    }
    res.sendStatus(200);
  } catch (err) {
    const status = err instanceof SyliError ? err.status || 400 : 400;
    res.sendStatus(status);
  }
});
```

Helpers autonomes :

```js
import { verifySignature, verifySignatureV2, constructEvent, isPaidStatus } from "syli-sdk";
```

## Documentation API

https://sylipayments.com/docs/api
