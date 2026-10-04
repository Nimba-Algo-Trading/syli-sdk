## 1.1.1

- Défaut `https://api.sylipayments.com/v1`. `https://sylipayments.com/api/v1` reste un alias.

## 1.1.0

- Webhooks v2 : `constructEvent(rawBody, headers, secret)` vérifie `x-syli-sig-v2` + `x-syli-timestamp` (HMAC-SHA256 de `` `${timestamp}.${rawBody}` ``, tolérance 5 min). Repli v1 si le body est déjà parsé.
- `SyliError.code` lit le champ `code` renvoyé par l’API.
- Helpers : `signPayloadV2`, `verifySignatureV2`, `eventIdFromHeaders`.
- Champ additif `livemode` ; `simulatePayment` (clé `syli_test_`).
- En-tête `x-syli-api-version: 2026-10` par défaut (401 sur clé invalide). Désactivez avec `apiVersion: ""` jusqu’au 2027-04-02.

## 1.0.2

- `getInvoice` renvoie le même objet statut que `getPayment` (`payment_status`, `actually_paid`, `actually_paid_usd`).
- `payment_id` peut être `null` tant que le client n’a pas choisi la crypto.
- `isPaidStatus()` (fonction et méthode) : `confirmed`, plus `sending` / `finished` pour les anciens webhooks.
- `prepare` compile `dist` pour `npm install github:Nimba-Algo-Trading/syli-sdk`.
