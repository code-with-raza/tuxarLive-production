import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import * as delivery from '../../supabase/functions/_shared/delivery.ts';
import * as returnsPolicy from '../../src/data/returns-policy.ts';

async function evaluate(path, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(await fs.readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {} });
  return exports;
}
const copy = await evaluate('src/lib/delivery.ts', { '../../supabase/functions/_shared/delivery': delivery });

test('new order estimate is 7–10 weekdays and skips weekends across month/year boundaries', () => {
  assert.equal(delivery.MIN_DELIVERY_WORKING_DAYS, 7);
  assert.equal(delivery.MAX_DELIVERY_WORKING_DAYS, 10);
  assert.deepEqual(delivery.estimatedDeliveryWindow(new Date('2026-10-23T12:00:00Z')), { from: '2026-11-03', to: '2026-11-06' });
  assert.deepEqual(delivery.estimatedDeliveryWindow(new Date('2026-10-24T12:00:00Z')), { from: '2026-11-03', to: '2026-11-06' });
  assert.deepEqual(delivery.estimatedDeliveryWindow(new Date('2026-12-25T12:00:00Z')), { from: '2027-01-05', to: '2027-01-08' });
  assert.throws(() => delivery.addWorkingDays(new Date('invalid'), 7));
  assert.throws(() => delivery.addWorkingDays(new Date(), -1));
});

test('all carrier methods use their shared estimate with no delivery surcharge', async () => {
  const endpoint = await fs.readFile('supabase/functions/create-checkout-session/index.ts', 'utf8');
  assert.match(endpoint, /estimatedDeliveryWindow\(new Date\(\), deliveryOption.maxDays\)/);
  assert.match(endpoint, /estimated_delivery_from: delivery\.from/);
  assert.match(endpoint, /estimated_delivery_to: delivery\.to/);
  assert.doesNotMatch(endpoint, /Date\.now\(\) \+.*86400000/);
  const checkout = await fs.readFile('src/routes/$locale.checkout.tsx', 'utf8');
  assert.match(checkout, /DELIVERY_OPTIONS.map/);
  assert.match(checkout, /const shippingCost = 0/);
  assert.match(checkout, /deliveryDaysLabel\(option.minDays, option.maxDays, locale\)/);
  assert.deepEqual(delivery.DELIVERY_OPTIONS.map(option => option.pricePence), [0,0,0]);
  assert.equal(delivery.estimatedDeliveryWindow(new Date('2026-10-23T12:00:00Z'),14).to,'2026-11-12');
});

test('all five markets appear in announcements without inventing new checkout charges', async () => {
  for (const locale of ['en', 'it', 'de', 'fr', 'es']) {
    const estimate = copy.deliveryEstimate(locale);
    assert.match(estimate, /7–10/);
    const dictionary = JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`, 'utf8'));
    assert.match(dictionary.announcement.shipping, /Italy|Italia|Italien|Italie/);
    assert.match(dictionary.announcement.shipping, /Germany|Germania|Deutschland|Alemania|Allemagne/);
    assert.ok(!/UK delivery:/.test(dictionary.announcement.shipping));
    assert.match(copy.carrierDeliveryEstimate(locale), /UPS: 7–14/);
    assert.match(copy.carrierDeliveryEstimate(locale), /DPD Geopost: 7–10/);
    assert.ok(copy.deliveryWorkingDaysNote(locale).length > 80);
  }
});

test('rendered shipping policy and FAQ structured data include the new estimate in every locale', async () => {
  let activeLocale = 'en';
  const modules = {
    '@tanstack/react-router': { createFileRoute: () => options => ({ ...options, useParams: () => ({ locale: activeLocale }) }) },
    'react/jsx-runtime': jsxRuntime,
    '@/components/site/PageHero': { PageHero: ({ title }) => React.createElement('h1', null, title) },
    '@/i18n/i18n': { t: key => key },
    '@/lib/delivery': copy,
    '@/data/returns-policy': returnsPolicy,
    '@/lib/seo': { absoluteUrl: path => `https://tuxar.co.uk${path}`, localizedAlternates: () => [] },
  };
  const policy = await evaluate('src/routes/$locale.shipping-policy.tsx', modules);
  const faq = await evaluate('src/routes/$locale.faq.tsx', modules);
  for (const locale of ['en', 'it', 'de', 'fr', 'es']) {
    activeLocale = locale;
    const estimate = copy.carrierDeliveryEstimate(locale);
    const html = renderToStaticMarkup(React.createElement(policy.Route.component));
    assert.ok(html.includes(estimate), locale);
    assert.ok(policy.Route.head({ params: { locale } }).meta.find(meta => meta.name === 'description').content.includes(copy.shippingDestinations(locale)));
    const answers = JSON.parse(faq.Route.head({ params: { locale } }).scripts[0].children).mainEntity;
    assert.ok(answers.some(question => question.acceptedAnswer.text.includes(estimate)), locale);
    assert.ok(!answers.some(question => /48.*(working|ore|Arbeits|heures|horas)|4[–-]6.*(weeks|settimane|Wochen|semanas)/i.test(question.acceptedAnswer.text)));
  }
});

test('product pages, confirmation and customer emails use the updated delivery estimate', async () => {
  assert.match(await fs.readFile('src/routes/$locale.product.$slug.tsx','utf8'),/carrierDeliveryEstimate\(locale\)/);
  assert.match(await fs.readFile('src/routes/$locale.confirmation.tsx','utf8'),/carrierDeliveryEstimate\(locale\)/);
  for (const path of ['supabase/functions/stripe-webhook/index.ts', 'supabase/functions/dispatch-order/index.ts']) {
    const source = await fs.readFile(path, 'utf8');
    assert.match(source, /\$\{orderDeliveryEstimate\(/);
  }
});
