import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { cartSelectionKey, cartStockAdjustments, variantKey } from "../../src/lib/cart-inventory.ts";
import { requestCustomerOtp } from "../../src/lib/customer-verification.ts";

const item = { slug: "test-product", size: "M", color: "Black", qty: 2 };
test("cart inventory identity is stable across quantity changes and ordering", () => {
  assert.equal(cartSelectionKey([item]), cartSelectionKey([{ ...item, qty: 3 }]));
  const other = { ...item, color: "Brown" };
  assert.equal(cartSelectionKey([item, other]), cartSelectionKey([other, item]));
  assert.notEqual(cartSelectionKey([item]), cartSelectionKey([other]));
});
test("unknown inventory never removes cart lines; known limits reconcile once", () => {
  assert.deepEqual(cartStockAdjustments([item], {}), []);
  assert.deepEqual(cartStockAdjustments([item], { [variantKey(item)]: 5 }), []);
  const adjustment = cartStockAdjustments([item], { [variantKey(item)]: 1 });
  assert.equal(adjustment[0].qty, 1);
  assert.deepEqual(cartStockAdjustments(adjustment, { [variantKey(item)]: 1 }), []);
  assert.equal(cartStockAdjustments([item], { [variantKey(item)]: 0 })[0].qty, 0);
});
test("variant identities cannot collide through separator characters", () => {
  assert.notEqual(variantKey({ slug: "test", size: "M|Black", color: "Blue" }), variantKey({ slug: "test", size: "M", color: "Black|Blue" }));
});
test("the actual Supabase SDK sends an explicit JSON body for OTP requests", async () => {
  let request;
  const client = createClient("https://project.supabase.co", "sb_publishable_localexample", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => { request = new Request(input, init); return Response.json({ sent: true }); } },
  });
  const response = await requestCustomerOtp(client);
  assert.equal(response.error, null);
  assert.equal(request.method, "POST");
  assert.match(request.url, /\/functions\/v1\/issue-customer-otp$/);
  assert.equal(request.headers.get("content-type"), "application/json");
  assert.deepEqual(await request.json(), {});
});
