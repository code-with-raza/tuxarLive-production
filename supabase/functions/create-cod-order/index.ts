import { secureServe } from "../_shared/http.ts";

// Retired payment method. Never parse a cart, create an order, decrement stock,
// or send emails from this endpoint. Existing COD order history is preserved.
secureServe("create-cod-order", { auth: "user", limit: 10, windowSeconds: 600 }, async () =>
  new Response(JSON.stringify({ error: "Cash on delivery is no longer available. Please pay online through secure checkout." }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  }),
);
