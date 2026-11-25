import { marketStub } from './helpers/market-stub.mjs';
import test from 'node:test';
import * as delivery from '../../supabase/functions/_shared/delivery.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createFormControl } = require('react-hook-form');
const code = ts.transpileModule(await fs.readFile('src/routes/$locale.checkout.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

function checkout(result = { data: { url: 'https://checkout.stripe.com/c/pay/test-session' }, error: null }) {
  const states = [], effects = [], calls = [], destinations = [];
  let index = 0, component, form;
  const cart = [{ slug: 'test-jacket', size: 'M', color: 'Black', qty: 1, name: 'Test jacket', image: '/test.webp', priceGBP: 199 }];
  const modules = { '@/lib/market': marketStub,
    react: { ...require('react'), useEffect: fn => effects.push(fn), useState(initial) { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; } },
    '@tanstack/react-router': { createFileRoute: () => options => { component = options.component; return { useParams: () => ({ locale: 'en' }) }; }, useNavigate: () => () => {}, Link: () => null },
    '@/hooks/useUser': { useUser: () => ({ user: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', tuxarVerified: true }, isLoading: false }) },
    '@/hooks/useCartInventory': { useCartInventory() {} },
    '@/store/shop': { useShop: () => ({ cart }), cartTotalGBP: () => 199 },
    '@/data/products': { formatGBP: n => `£${n}` },
    '@/i18n/i18n': { t: () => '', getLocalizedLink: path => ({ to: `/en${path}` }) },
    'react-hook-form': { useForm(options) { form ??= createFormControl(options); return { ...form, formState: { errors: {} } }; } },
    '@/lib/supabase': { isSupabaseConfigured: () => true, supabase: { functions: { invoke: async (...args) => { calls.push(args); return result; } } } },
    '@/lib/payments': { isStripeEnabled: true }, '@/lib/delivery': { ...delivery, deliveryDaysLabel: (min,max) => min+'–'+max+' working days', freeDeliveryLabel: () => 'Free' },
    '@/components/AccountCheckError': { AccountCheckError: () => null },
    sonner: { toast: { success() {}, error() {} } },
  };
  vm.runInNewContext(code, { exports: {}, require: name => modules[name] ?? require(name), window: { location: { assign: url => destinations.push(url) } } });
  const render = () => { index = 0; return component(); };
  const tree = render();
  effects.forEach(fn => fn());
  const valid = { customerPhone: '02000000000', streetAddress: '1 Test Street', city: 'London', postalCode: 'SW1A 1AA', country: 'United Kingdom' };
  for (const [name, value] of Object.entries(valid)) form.setValue(name, value);
  return { calls, destinations, states, cart, form, render, submit: () => find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {}, persist() {} }) };
}

test('valid checkout runs the real form resolver, calls the payment function and opens its Stripe URL', async () => {
  const h = checkout();
  await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'create-checkout-session');
  const body = h.calls[0][1].body;
  assert.equal(body.customer.paymentMethod, 'STRIPE');
  assert.equal(body.customer.customerEmail, 'test@example.com');
  assert.equal(body.items[0].slug, 'test-jacket');
  assert.equal(body.items[0].qty, 1);
  assert.deepEqual(h.destinations, ['https://checkout.stripe.com/c/pay/test-session']);
});

test('unavailable USD pricing disables payment and blocks even a direct form submission',async()=>{
  const previous=marketStub.useMarketCurrency;
  try {
    marketStub.useMarketCurrency=()=>({...previous('en'),currency:'USD',currencyReady:false,usdQuote:null});
    const h=checkout();
    assert.equal(find(h.render(),node=>node.type==='button'&&node.props.type==='submit').props.disabled,true);
    await h.submit();assert.equal(h.calls.length,0);assert.equal(h.destinations.length,0);
    assert.match(h.states[0],/Refresh USD pricing/);
  } finally {marketStub.useMarketCurrency=previous}
});

test('missing contact details show an alert beside the payment button without starting a session', async () => {
  const h = checkout();
  h.form.setValue('customerPhone', '');
  await h.submit();
  assert.equal(h.calls.length, 0);
  assert.match(h.states[0], /Phone number/);
  const tree = h.render();
  const form = find(tree, node => node.type === 'form');
  assert.equal(form.props.noValidate, true, 'the form resolver must handle validation, including email errors');
  const aside = find(tree, node => node.type === 'aside');
  assert.equal(find(aside, node => node.props?.role === 'alert').props.children, h.states[0]);
  assert.equal(find(aside, node => node.type === 'button' && node.props.type === 'submit').props['aria-describedby'], 'checkout-submit-error');
});

test('server failures expose the actual error instead of a generic Edge Function message', async () => {
  for (const field of ['error', 'message']) {
    const h = checkout({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: Response.json({ [field]: 'Checkout is temporarily unavailable for maintenance.' }, { status: 503 }) } });
    await h.submit();
    assert.match(h.states[0], /temporarily unavailable for maintenance/);
    assert.equal(h.destinations.length, 0);
  }
});

test('malformed responses and transport failures never redirect or silently succeed', async () => {
  for (const result of [{ data: {}, error: null }, { data: { error: 'Selected size is no longer available' }, error: null }, { data: null, error: { message: 'Failed to send a request to the Edge Function' } }]) {
    const h = checkout(result);
    await h.submit();
    assert.ok(h.states[0]);
    assert.equal(h.destinations.length, 0);
    assert.equal(h.states[4], false);
  }
});
