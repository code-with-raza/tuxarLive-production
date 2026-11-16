import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

let endpoint;
const originalFetch = globalThis.fetch;
const secret = "local-webhook-test-secret";
const orderId = "00000000-0000-4000-8000-000000000001";
beforeEach(async () => {
  globalThis.Deno = { env: { get: (name) => ({ STRIPE_WEBHOOK_SECRET: secret, SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "local-service-test" })[name] }, serve: (handler) => { endpoint = handler; } };
  await import(`../../supabase/functions/stripe-webhook/index.ts?case=${Math.random()}`);
});
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.Deno; });
function signed(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return new Request("https://project.supabase.co/functions/v1/stripe-webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` }, body });
}
const event = (extra = {}) => JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_live_Example", metadata: { order_id: orderId }, payment_status: "paid", amount_total: 39900, currency: "gbp", ...extra } } });
test("Stripe rejects forged signatures and old or nonnumeric timestamps", async () => {
  const forged = new Request("https://project.supabase.co", { method: "POST", body: event() });
  assert.equal((await endpoint(forged)).status, 400);
  assert.equal((await endpoint(signed(event(), "notanumber"))).status, 400);
  assert.equal((await endpoint(signed(event(), String(Math.floor(Date.now() / 1000) - 600)))).status, 400);
});
test("Stripe rejects malformed signed JSON and oversized payloads", async () => {
  assert.equal((await endpoint(signed("{"))).status, 400);
  assert.equal((await endpoint(signed("x".repeat(1048577)))).status, 413);
});

test("malformed signature fields and signed non-event bodies are rejected without crashing", async () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const malformed = new Request("https://project.supabase.co", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1` }, body: event() });
  assert.equal((await endpoint(malformed)).status, 400);
  for (const body of ["null", "[]", "{}", '{"type":"checkout.session.completed"}']) assert.equal((await endpoint(signed(body))).status, 400);
});

test("a verified later payment success may recover failed status but never overwrite paid or refunded status", async () => {
  let updateUrl;
  globalThis.fetch = async (url, options) => {
    if (options?.method === "PATCH") { updateUrl = String(url); return new Response(null, { status: 204 }); }
    if (String(url).includes("select=stripe_checkout_session_id")) return Response.json([{ stripe_checkout_session_id: "cs_live_Example", payment_method: "stripe", total_pence: 39900, currency: "GBP" }]);
    return Response.json([{ order_status: "pending", payment_status: "paid", payment_email_sent_at: "2026-01-01" }]);
  };
  assert.equal((await endpoint(signed(event()))).status, 200);
  assert.match(updateUrl, /payment_status=in\.\(pending,failed\)/);
  assert.match(updateUrl, /order_status=neq.cancelled/);
});
test("a signed payment must match the stored session, amount, and currency", async () => {
  let writes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "PATCH") { writes += 1; return new Response(null, { status: 204 }); }
    return Response.json([{ stripe_checkout_session_id: "cs_live_Example", payment_method: "stripe", total_pence: 39900, currency: "GBP" }]);
  };
  assert.equal((await endpoint(signed(event({ id: "cs_live_Other" })))).status, 400);
  assert.equal((await endpoint(signed(event({ amount_total: 1 })))).status, 400);
  assert.equal((await endpoint(signed(event({ currency: "usd" })))).status, 400);
  assert.equal(writes, 0);
});

test("EUR webhook settles an EUR order and rejects GBP even when the amount is identical",async()=>{
  let writes=0;
  globalThis.fetch=async(url,options)=>{
    if(options?.method==='PATCH'){writes++;return new Response(null,{status:204});}
    if(String(url).includes('select=stripe_checkout_session_id'))return Response.json([{stripe_checkout_session_id:'cs_live_Example',payment_method:'stripe',total_pence:39900,currency:'EUR'}]);
    return Response.json([{order_status:'pending',payment_status:'paid',payment_email_sent_at:'2026-01-01'}]);
  };
  assert.equal((await endpoint(signed(event({currency:'gbp'})))).status,400);assert.equal(writes,0);
  assert.equal((await endpoint(signed(event({currency:'eur'})))).status,200);assert.equal(writes,1);
});
test("fully discounted checkouts settle only when both Stripe and the stored order total are zero", async () => {
  let total = 0;
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (options?.method === "PATCH") { writes += 1; return new Response(null, { status: 204 }); }
    if (String(url).includes("select=stripe_checkout_session_id")) return Response.json([{ stripe_checkout_session_id: "cs_live_Example", payment_method: "stripe", total_pence: total, currency: "GBP" }]);
    return Response.json([{ order_status: "pending", payment_status: "paid", payment_email_sent_at: "2026-01-01" }]);
  };
  assert.equal((await endpoint(signed(event({ amount_total: 0, payment_status: "no_payment_required" })))).status, 200);
  assert.equal(writes, 1);
  total = 39900;
  assert.equal((await endpoint(signed(event({ amount_total: 0, payment_status: "no_payment_required" })))).status, 400);
  assert.equal(writes, 1);
});

test("expired session events can change only a pending, noncancelled order", async () => {
  let updateUrl;
  globalThis.fetch = async (url, options) => {
    if (options?.method === "PATCH") { updateUrl = String(url); return new Response(null, { status: 204 }); }
    return Response.json([{ stripe_checkout_session_id: "cs_live_Example", payment_method: "stripe", total_pence: 39900, currency: "GBP" }]);
  };
  const body = JSON.stringify({ type: "checkout.session.expired", data: { object: { id: "cs_live_Example", metadata: { order_id: orderId } } } });
  assert.equal((await endpoint(signed(body))).status, 200);
  assert.match(updateUrl, /payment_status=eq.pending/); assert.match(updateUrl, /order_status=neq.cancelled/);
});
