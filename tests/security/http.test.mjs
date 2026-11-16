import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSecureHandler, validateCheckout, readLimitedText } from "../../supabase/functions/_shared/http.ts";
import { assertPublicEnvironment } from "../../scripts/public-env.mjs";
import { sanitizeRichHtml } from "../../src/lib/sanitize.ts";

const realFetch = globalThis.fetch;
const userId = "00000000-0000-4000-8000-000000000001";
const environment = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-service-only", OTP_PEPPER: "local-test-pepper" };
let calls;
beforeEach(() => {
  calls = [];
  globalThis.Deno = { env: { get: (name) => environment[name] } };
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes("consume_security_rate_limit")) return Response.json(true);
    if (String(url).includes("/auth/v1/user")) return Response.json({ id: userId, email: "test@example.com" });
    if (String(url).includes("/admin_users")) return Response.json([{ role: "admin" }]);
    if (String(url).includes("/customer_profiles")) return Response.json([{ account_status: "active" }]);
    throw new Error(`Unexpected endpoint in test: ${String(url).split("?")[0]}`);
  };
});
afterEach(() => { globalThis.fetch = realFetch; delete globalThis.Deno; });
const request = (body = {}, extra = {}) => new Request("https://project.supabase.co/functions/v1/test", {
  method: "POST", headers: { Origin: "https://tuxar.co.uk", "Content-Type": "application/json", ...extra }, body: JSON.stringify(body),
});
const handler = (options = { auth: "public" }) => createSecureHandler("test", options, () => Response.json({ ok: true }, { headers: { "Access-Control-Allow-Origin": "*" } }));
const bearer = (aal) => `Bearer ${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, aal })).toString("base64url")}.test-signature`;

test("CORS denies untrusted origins before business or database calls", async () => {
  const response = await handler()(request({}, { Origin: "https://attacker.example" }));
  assert.equal(response.status, 403); assert.equal(response.headers.get("access-control-allow-origin"), null); assert.equal(calls.length, 0);
});
test("preflight explicitly allows the store, without wildcard credentials", async () => {
  const response = await handler()(new Request("https://project.supabase.co", { method: "OPTIONS", headers: { Origin: "https://tuxar.co.uk" } }));
  assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-origin"), "https://tuxar.co.uk"); assert.equal(calls.length, 0);
});
test("localhost is excluded from production origins", async () => {
  assert.equal((await handler()(request({}, { Origin: "http://localhost:5173" }))).status, 403);
});
test("successful responses remove wildcard CORS and prevent caching", async () => {
  const response = await handler()(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "https://tuxar.co.uk");
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("vary"), "Origin");
});
test("rejects unsupported methods and media types", async () => {
  assert.equal((await handler()(new Request("https://project.supabase.co"))).status, 405);
  assert.equal((await handler()(request({}, { "Content-Type": "text/plain" }))).status, 415);
});
test("rejects malformed JSON, arrays, and pollution keys", async () => {
  const bad = new Request("https://project.supabase.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await handler()(bad)).status, 400);
  assert.equal((await handler()(request([]))).status, 400);
  assert.equal((await handler()(request(JSON.parse('{"__proto__":{"admin":true}}')))).status, 400);
});
test("body limit is enforced on actual bytes without trusting Content-Length", async () => {
  assert.equal((await handler()(request({ value: "x".repeat(70000) }))).status, 413);
  await assert.rejects(readLimitedText(request({}, { "Content-Length": "9999999" })), { status: 413 });
});
test("distributed limits fail closed and return Retry-After", async () => {
  globalThis.fetch = async () => Response.json(false);
  const limited = await handler()(request()); assert.equal(limited.status, 429); assert.ok(limited.headers.get("retry-after"));
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  assert.equal((await handler()(request())).status, 503);
});

test("array or missing emails cannot bypass the per-email quota", async () => {
  for (const email of [undefined, ["test@example.com"], { email: "test@example.com" }, null]) {
    assert.equal((await handler({ auth: "public", emailLimit: 3 })(request({ email }))).status, 400);
  }
});

test("checkout maintenance refuses new orders before auth or rate-limit database calls", async () => {
  environment.CHECKOUT_MAINTENANCE = "true";
  try {
    for (const name of ["create-checkout-session", "create-cod-order"]) {
      const guarded = createSecureHandler(name, { auth: "user" }, () => { throw new Error("Must not create orders"); });
      assert.equal((await guarded(request())).status, 503);
    }
    assert.equal(calls.length, 0);
    assert.equal((await handler()(request())).status, 200);
  } finally { delete environment.CHECKOUT_MAINTENANCE; }
});

test("refund initiation never calls Stripe if the database reservation is denied", async () => {
  let endpoint;
  const normalFetch = globalThis.fetch;
  globalThis.Deno.serve = (callback) => { endpoint = callback; };
  environment.STRIPE_SECRET_KEY = "local-stripe-server-key";
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/orders?")) return Response.json([{ id: userId, payment_method: "stripe", order_status: "pending", payment_status: "paid", stripe_payment_intent_id: "pi_LocalTest" }]);
    if (String(url).includes("/prepare_stripe_cancellation")) return new Response(null, { status: 409 });
    return normalFetch(url, options);
  };
  try {
    await import("../../supabase/functions/cancel-stripe-order/index.ts");
    const response = await endpoint(request({ orderId: userId, reasonCode: "other" }, { Authorization: bearer("aal2") }));
    assert.equal(response.status, 409);
    assert.ok(!calls.some((url) => url.includes("api.stripe.com")));
  } finally { delete environment.STRIPE_SECRET_KEY; }
});

test("registration resend never sends an OTP that could not be persisted", async () => {
  let endpoint;
  const normalFetch = globalThis.fetch;
  globalThis.Deno.serve = (callback) => { endpoint = callback; };
  environment.RESEND_API_KEY = "local-email-server-key";
  environment.AUTH_FROM_EMAIL = "accounts@example.com";
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/customer_profiles?")) return Response.json([{ user_id: userId }]);
    if (String(url).includes("/customer_otp_challenges")) return options?.method === "POST" ? new Response(null, { status: 503 }) : Response.json([]);
    return normalFetch(url, options);
  };
  try {
    await import("../../supabase/functions/resend-email-registration/index.ts");
    assert.equal((await endpoint(request({ email: "test@example.com" }))).status, 503);
    assert.ok(!calls.some((url) => url.includes("api.resend.com")));
  } finally { delete environment.RESEND_API_KEY; delete environment.AUTH_FROM_EMAIL; }
});
test("protected endpoints reject missing and forged authentication", async () => {
  assert.equal((await handler({ auth: "user" })(request())).status, 401);
  globalThis.fetch = async (url) => String(url).includes("consume_security_rate_limit") ? Response.json(true) : new Response(null, { status: 401 });
  assert.equal((await handler({ auth: "user" })(request({}, { Authorization: bearer("aal2") }))).status, 401);
});
test("staff endpoints require both the database role and MFA", async () => {
  assert.equal((await handler({ auth: "staff", roles: ["admin"] })(request({}, { Authorization: bearer("aal1") }))).status, 403);
  assert.equal((await handler({ auth: "staff", roles: ["owner"] })(request({}, { Authorization: bearer("aal2") }))).status, 403);
  assert.equal((await handler({ auth: "staff", roles: ["admin"] })(request({}, { Authorization: bearer("aal2") }))).status, 200);
});

test("disabled accounts are blocked even with a valid staff MFA token", async () => {
  const normalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url).includes("/customer_profiles") ? Response.json([{ account_status: "disabled" }]) : normalFetch(url, options);
  for (const auth of ["user", "staff"]) assert.equal((await handler({ auth })(request({}, { Authorization: bearer("aal2") }))).status, 403);
});
test("payment verification rejects another customer's session before calling Stripe", async () => {
  let endpoint;
  globalThis.Deno.serve = (callback) => { endpoint = callback; };
  const normalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url).includes("/orders?") ? Response.json([]) : normalFetch(url, options);
  environment.STRIPE_SECRET_KEY = "test-stripe-server-key";
  await import("../../supabase/functions/verify-checkout-session/index.ts");
  const response = await endpoint(request({ sessionId: "cs_live_ownerOtherAccount" }, { Authorization: bearer("aal1") }));
  assert.equal(response.status, 404); assert.ok(!calls.some((url) => url.includes("api.stripe.com")));
  delete environment.STRIPE_SECRET_KEY;
});

test("checkout uses database prices and never returns an unrecorded Stripe session", async () => {
  let endpoint;
  let saveSucceeds = true;
  let stripePrice;
  let expired = false;
  let insertedUser;
  globalThis.Deno.serve = (callback) => { endpoint = callback; };
  const normalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes("/customer_profiles")) return Response.json([{ account_status: "active", tuxar_verified: true, user_id: userId }]);
    if (target.includes("/products?")) return Response.json([{ name: "Database jacket", price_pence: 39900, product_variants: [{ sku: "TEST-M", stock: 5, price_pence: 38900 }] }]);
    if (target.endsWith("/orders") && options.method === "POST") { insertedUser = JSON.parse(options.body).user_id; return Response.json([{ id: "00000000-0000-4000-8000-000000000099" }]); }
    if (target.includes("/orders?id=") && options.method === "PATCH") return new Response(null, { status: saveSucceeds ? 204 : 503 });
    if (target.endsWith("/order_items")) return new Response(null, { status: 204 });
    if (target.endsWith("/checkout/sessions/cs_test_session123/expire")) { expired = true; return Response.json({ status: "expired" }); }
    if (target.endsWith("/checkout/sessions")) { stripePrice = options.body.get("line_items[0][price_data][unit_amount]"); return Response.json({ id: "cs_test_session123", url: "https://checkout.stripe.com/test" }); }
    return normalFetch(url, options);
  };
  environment.STRIPE_SECRET_KEY = "test-stripe-server-key";
  await import("../../supabase/functions/create-checkout-session/index.ts");
  const payload = { userId: "attacker-supplied-owner", price: 1, items: [{ slug: "jacket", size: "M", color: "Black", qty: 1 }], customer: { customerName: "Test Person", customerEmail: "ignored@example.com", customerPhone: "01234567890", streetAddress: "1 Test Street", city: "London", postalCode: "E1 1AA", country: "United Kingdom", shippingMethod: "UPS" } };
  const response = await endpoint(request(payload, { Authorization: bearer("aal1") }));
  assert.equal(response.status, 200); assert.equal(stripePrice, "38900"); assert.equal(insertedUser, userId);
  saveSucceeds = false;
  const failed = await endpoint(request(payload, { Authorization: bearer("aal1") }));
  assert.equal(failed.status, 502); assert.equal(expired, true); assert.equal((await failed.json()).url, undefined);
  delete environment.STRIPE_SECRET_KEY;
});
test("cart validation rejects duplicate, invalid, and excessive quantities", () => {
  const customer = { customerName: "Test Person", customerPhone: "01234567890", streetAddress: "1 Test Street", city: "London", postalCode: "E1 1AA", country: "United Kingdom" };
  const item = { slug: "jacket", size: "M", color: "Black", qty: 1 };
  assert.doesNotThrow(() => validateCheckout({ customer, items: [item] }));
  assert.throws(() => validateCheckout({ customer, items: [item, item] }));
  for (const qty of [-1, 0, 1.5, 11, "1"]) assert.throws(() => validateCheckout({ customer, items: [{ ...item, qty }] }));
});

test("real checkout guard permits all five shipping markets and rejects every other country", async () => {
  const customer = { customerName: "Test Person", customerPhone: "01234567890", streetAddress: "1 Test Street", city: "London", postalCode: "E1 1AA" };
  const items = [{ slug: "jacket", size: "M", color: "Black", qty: 1 }];
  let businessCalls = 0;
  const guarded = createSecureHandler("create-checkout-session", { auth: "user" }, () => { businessCalls++; return Response.json({ ok: true }); });
  for (const country of ["United Kingdom", "Germany", "Spain", "France", "Italy", "GB", "UK", "DE", "ES", "FR", "IT", " germany "]) {
    const result = await guarded(request({ customer: { ...customer, country }, items }, { Authorization: bearer("aal1") }));
    assert.equal(result.status, 200, country);
  }
  for (const country of ["United States", "United Kingdom<script>", "DE-other", "Canada"]) {
    calls.length = 0;
    const previousBusinessCalls = businessCalls;
    const result = await guarded(request({ customer: { ...customer, country }, items }, { Authorization: bearer("aal1") }));
    assert.equal(result.status, 400, country);
    assert.equal(businessCalls, previousBusinessCalls, 'invalid shipping must never reach the checkout business handler');
    assert.ok(!calls.some(url => url.includes('/rest/v1/orders') || url.includes('api.stripe.com')));
  }
});
test("HTML sanitizer removes executable content and preserves ordinary formatting", () => {
  const dirty = '<h2 id="test">Title</h2><p style="text-align:center; background:url(javascript:alert(1))">Text <strong>bold</strong></p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="java&#x73;cript:alert(1)">bad</a><svg onload="alert(1)"></svg><iframe src="https://example.com"></iframe>';
  const clean = sanitizeRichHtml(dirty);
  assert.doesNotMatch(clean, /<script|onerror|onload|javascript|<svg|<iframe|background:/i);
  assert.match(clean, /<strong>bold<\/strong>/); assert.match(clean, /id="test"/); assert.match(clean, /text-align:center/);
});
test("browser environment guard accepts public keys but rejects private or unknown variables", () => {
  assert.doesNotThrow(() => assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" }));
  assert.throws(() => assertPublicEnvironment({ VITE_OTHER_SECRET: "not-for-browser" }));
  const privateJwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  assert.throws(() => assertPublicEnvironment({ VITE_SUPABASE_ANON_KEY: privateJwt }));
  assert.throws(() => assertPublicEnvironment({ VITE_GA_MEASUREMENT_ID: privateJwt }));
  assert.throws(() => assertPublicEnvironment({ VITE_SUPABASE_URL: "https://user:private@example.com" }));
  assert.throws(() => assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example" }));
});
