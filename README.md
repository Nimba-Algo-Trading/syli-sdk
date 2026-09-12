# SDK JavaScript SYLI

Client Node.js (≥ 18) pour l’API [SYLI](https://sylipayments.com) : paiements crypto, checkout hébergé, et vérification des webhooks (`x-syli-sig`).

Dépôt : [Nimba-Algo-Trading/syli-sdk](https://github.com/Nimba-Algo-Trading/syli-sdk)

> Serveur uniquement : la clé `syli_live_…` ne doit jamais partir dans le navigateur.

## Installation

Depuis npm (après publication) :

```bash
npm install syli-sdk
```

Depuis ce dépôt GitHub :

```bash
npm install github:Nimba-Algo-Trading/syli-sdk
```

## Usage

```js
import { Syli } from "syli-sdk";

const syli = new Syli({
  apiKey: process.env.SYLI_API_KEY,
  // apiUrl: "https://sylipayments.com/api/v1", // défaut
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
const latest = await syli.getPayment(payment.payment_id);
```

Utilitaires :

```js
await syli.getStatus();
await syli.getCurrencies(); // cryptos du compte (wallet validé, clé envoyée)
await syli.estimate({ amount: 20, currency_from: "usdt", currency_to: "btc" });
await syli.getMinAmount({ currency_from: "usdt", currency_to: "btc" });
```

CommonJS :

```js
const { Syli } = require("syli-sdk");
```

## Webhooks

Header `x-syli-sig` = HMAC-SHA512 de `JSON.stringify(payload, Object.keys(payload).sort())`.
Parsez le JSON, puis vérifiez — ne signez pas le body HTTP brut. Répondez **2xx**.
Livrez si `payment_status === "confirmed"` (payin client). `payout_status` = versement wallet.

Express :

```js
import express from "express";
import { Syli, SyliError } from "syli-sdk";

const syli = new Syli({ apiKey: process.env.SYLI_API_KEY });
const app = express();
app.use(express.json());

app.post("/webhooks/syli", (req, res) => {
  try {
    const event = syli.constructEvent(
      req.body,
      req.headers["x-syli-sig"],
      process.env.SYLI_IPN_SECRET,
    );
    if (event.payment_status === "confirmed") {
      // marquer la commande event.order_id comme payée
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
import { verifySignature, constructEvent } from "syli-sdk";
```

## Publier sur npm

```bash
npm install
npm run build
npm login
npm publish --access public
```

## Documentation API

https://sylipayments.com/docs/api
