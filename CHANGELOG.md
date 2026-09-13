# Changelog

## 1.0.2

- `getInvoice` renvoie le même objet statut que `getPayment` (`payment_status`, `actually_paid`, `actually_paid_usd`).
- `payment_id` peut être `null` tant que le client n’a pas choisi la crypto.
- `isPaidStatus()` (fonction et méthode) : `confirmed`, plus `sending` / `finished` pour les anciens webhooks.
- `prepare` compile `dist` pour `npm install github:Nimba-Algo-Trading/syli-sdk`.
