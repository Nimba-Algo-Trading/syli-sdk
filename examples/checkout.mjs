/**
 * Exemple checkout hébergé.
 * SYLI_API_KEY=syli_live_… node examples/checkout.mjs
 */
import { Syli } from "../dist/index.js";

const apiKey = process.env.SYLI_API_KEY;
if (!apiKey) {
  console.error("Définissez SYLI_API_KEY");
  process.exit(1);
}

const syli = new Syli({ apiKey });
const invoice = await syli.createInvoice({
  price_amount: 20,
  price_currency: "usdt",
  order_id: `DEMO-${Date.now()}`,
  order_description: "Exemple SDK JavaScript",
});
console.log(invoice.invoice_url);
