import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as z from 'zod';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

function evaluate(source, modules = {}, context = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, ...context });
  return exports;
}

test('supplied men jacket chart is unchanged and applies to all men jackets, never women, bags or suits', async () => {
  const bytes = await fs.readFile('public/size-charts/mens-jackets.webp');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '547529532c89d8975abe24bfd35c76eb5fb523b69bee2fe4ab956f9cde224b8b');
  const audience = evaluate(await fs.readFile('src/lib/product-audience.ts', 'utf8'));
  const categories = evaluate(await fs.readFile('src/lib/catalogCategories.ts', 'utf8'));
  const charts = evaluate(await fs.readFile('src/lib/size-chart-assets.ts', 'utf8'));
  const api = evaluate(await fs.readFile('src/components/site/MensJacketSizeChart.tsx', 'utf8'), {
    '@/lib/product-audience': audience, '@/lib/catalogCategories': categories, 'react/jsx-runtime': jsxRuntime, '@/lib/size-chart-assets': charts,
  });
  const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8')).products;
  const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
  for (const product of men) assert.equal(api.usesMensJacketChart(product), true);
  for (const product of women) assert.equal(api.usesMensJacketChart(product), false);
  for (const category of ['motorcycle-suits', 'accessories', 'leather-bags']) assert.equal(api.usesMensJacketChart({ slug: 'test', name: 'Test', category }), false);
  const html = renderToStaticMarkup(React.createElement(api.MensJacketSizeChart));
  assert.ok(html.includes(charts.MENS_JACKET_SIZE_CHART));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('width="1600"'));
  assert.match(await fs.readFile('src/routes/$locale.product.$slug.tsx', 'utf8'), /usesMensJacketChart\(p\) && <MensJacketSizeChart/);
});

test('checkout accepts only STRIPE, defaults to online payment, and cannot invoke the retired COD endpoint', async () => {
  const source = await fs.readFile('src/routes/$locale.checkout.tsx', 'utf8');
  const schemaSource = source.slice(source.indexOf('const checkoutSchema'), source.indexOf('type CheckoutFields'));
  const api = evaluate(schemaSource + '\nexports.schema=checkoutSchema;', {}, { z });
  const customer = { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '12345678', streetAddress: '123 Test Road', city: 'London', postalCode: 'SW1A 1AA', country: 'United Kingdom', shippingMethod: 'UPS' };
  assert.equal(api.schema.safeParse({ ...customer, paymentMethod: 'STRIPE' }).success, true);
  assert.equal(api.schema.safeParse({ ...customer, paymentMethod: 'COD' }).success, false);
  assert.match(source, /paymentMethod: "STRIPE"/);
  assert.match(source, /invoke\("create-checkout-session"/);
  assert.match(source, /disabled=\{isSubmitting \|\| !isStripeEnabled \|\| !currencyReady\}/);
  assert.doesNotMatch(source, /create-cod-order|Cash on delivery|cash-on-delivery|value="COD"|clearCart\(\)/);
});

test('retired COD endpoint returns 410 with no order, stock, email or network side effects', async () => {
  let handler;
  const source = await fs.readFile('supabase/functions/create-cod-order/index.ts', 'utf8');
  evaluate(source, { '../_shared/http.ts': { secureServe: (_name, _policy, fn) => { handler = fn; } } }, { Response, fetch: () => { throw new Error('No network calls allowed'); } });
  const response = await handler();
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /pay online/);
  assert.doesNotMatch(source, /fetch\(|request\.json\(|resend\.com|place_cod_order/);
  const migration = await fs.readFile('supabase/migrations/202610260001_disable_cash_on_delivery.sql', 'utf8');
  for (const name of ['place_cod_order(', 'place_cod_order_internal(', 'place_cod_order_for_user(']) assert.ok(migration.includes(name));
  assert.match(migration, /revoke execute on function %s from public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /delete from|drop table|truncate|place_stripe_order/i);
});
