import { marketStub } from './helpers/market-stub.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const source = (await fs.readFile('src/hooks/useUser.ts', 'utf8')).replaceAll('import.meta.env', '({ VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key" })');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
const customer = { id: 'customer-1', email: 'test@example.com', user_metadata: {}, app_metadata: {} };
const verified = { data: { tuxar_verified: true, account_status: 'active' }, error: null };

async function mount() {
  const states = [], refs = [], timers = [], effects = [], requests = [];
  let stateIndex = 0, refIndex = 0, callback, unsubscribed = false;
  const react = {
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect(effect) { effects.push(effect); },
    useCallback: fn => fn,
  };
  const supabase = {
    auth: {
      // INITIAL_SESSION already restores storage. Calling this as well caused the race.
      getSession() { throw new Error('Duplicate initial session read'); },
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
    },
    from() {
      const query = { select() { return query; }, eq() { return query; }, abortSignal() { return query; }, maybeSingle() { return new Promise((resolve, reject) => requests.push({ resolve, reject })); } };
      return query;
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? react : name === '@/lib/supabase' ? { supabase } : {}, AbortSignal, window: { location: { hash: '', search: '' } }, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} });
  const snapshot = () => { stateIndex = 0; refIndex = 0; return exports.useUser(); };
  snapshot();
  const cleanup = effects[0]();
  timers.shift()();
  await flush();
  return { snapshot, requests, cleanup, get unsubscribed() { return unsubscribed; }, async emit(user, event = 'SIGNED_IN') { callback(event, user ? { user } : null); while (timers.length) timers.shift()(); await flush(); } };
}

test('a saved verified session reaches checkout only after its profile is resolved', async () => {
  const h = await mount();
  await h.emit(customer, 'INITIAL_SESSION');
  assert.equal(h.snapshot().isLoading, true);
  assert.equal(h.snapshot().user, null);
  h.requests[0].resolve(verified);
  await flush();
  assert.equal(h.snapshot().isLoading, false);
  assert.equal(h.snapshot().user.tuxarVerified, true);
});

test('older profile responses cannot release the current checkout guard', async () => {
  const h = await mount();
  await h.emit(customer, 'INITIAL_SESSION');
  await h.emit(customer, 'SIGNED_IN');
  h.requests[0].resolve(verified);
  await flush();
  assert.equal(h.snapshot().isLoading, true, 'checkout must not redirect to login while the latest profile is pending');
  assert.equal(h.snapshot().user, null);
  h.requests[1].resolve(verified);
  await flush();
  assert.equal(h.snapshot().isLoading, false);
  assert.equal(h.snapshot().user.id, customer.id);
});

test('sign-out wins over a late signed-in profile and cleanup ignores pending results', async () => {
  const h = await mount();
  await h.emit(customer);
  await h.emit(null, 'SIGNED_OUT');
  h.requests[0].resolve(verified);
  await flush();
  assert.equal(h.snapshot().user, null);
  assert.equal(h.snapshot().isLoading, false);
  await h.emit(customer);
  h.cleanup();
  h.requests[1].resolve(verified);
  await flush();
  assert.equal(h.snapshot().user, null);
  assert.equal(h.unsubscribed, true);
});

test('profile network errors stop loading and expose a retryable error', async () => {
  const h = await mount();
  await h.emit(customer);
  h.requests[0].resolve({ data: null, error: { message: 'Network failure' } });
  await flush();
  assert.equal(h.snapshot().isLoading, false);
  assert.equal(h.snapshot().user, null);
  assert.ok(h.snapshot().authError);
});

test('disabled and unverified accounts do not gain checkout access', async () => {
  for (const profile of [{ tuxar_verified: false, account_status: 'active' }, { tuxar_verified: true, account_status: 'disabled' }]) {
    const h = await mount();
    await h.emit(customer);
    h.requests[0].resolve({ data: profile, error: null });
    await flush();
    assert.notEqual(h.snapshot().user?.tuxarVerified, true);
    assert.equal(h.snapshot().isLoading, false);
  }
});

async function routeRedirects(page, auth) {
  const effects = [], redirects = [];
  let component;
  const route = { useParams: () => ({ locale: 'en' }), useSearch: () => ({ returnTo: '/en/checkout' }) };
  const modules = { '@/lib/market': marketStub,
    react: { ...require('react'), useEffect: fn => effects.push(fn), useState: initial => [initial, () => {}] },
    '@tanstack/react-router': { createFileRoute: () => options => { component = options.component; return route; }, useNavigate: () => options => redirects.push(options), Link: () => null },
    '@/hooks/useUser': { useUser: () => auth },
    '@/hooks/useCartInventory': { useCartInventory() {} },
    '@/store/shop': { useShop: () => ({ cart: [] }), cartTotalGBP: () => 0 },
    '@/data/products': { formatGBP: () => '' },
    '@/i18n/i18n': { t: key => key, getLocalizedLink: path => ({ to: `/en${path}` }) },
    'react-hook-form': { useForm: () => ({ register: () => ({}), handleSubmit: fn => fn, setValue() {}, watch: () => 'STANDARD', formState: { errors: {} } }) },
    '@/lib/supabase': {}, '@/lib/payments': {}, '@/lib/delivery': {DELIVERY_COUNTRIES:[{code:'GB',name:'United Kingdom'}]},
    '@/components/AccountCheckError': { AccountCheckError: () => null },
  };
  const routeCode = ts.transpileModule(await fs.readFile(`src/routes/$locale.${page}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(routeCode, { exports: {}, require: name => modules[name] ?? require(name) });
  component();
  effects.forEach(fn => fn());
  return redirects.map(options => ({ to: options.to, returnTo: options.search?.returnTo }));
}

test('actual login and checkout routes preserve returnTo without redirecting during loading or errors', async () => {
  for (const page of ['login', 'checkout']) {
    assert.deepEqual(await routeRedirects(page, { user: null, isLoading: true }), []);
    assert.deepEqual(await routeRedirects(page, { user: null, isLoading: false, authError: 'Network failure' }), []);
  }
  assert.deepEqual(await routeRedirects('checkout', { user: null, isLoading: false }), [{ to: '/en/login', returnTo: '/en/checkout' }]);
  assert.deepEqual(await routeRedirects('login', { user: { tuxarVerified: true }, isLoading: false }), [{ to: '/en/checkout', returnTo: undefined }]);
  assert.deepEqual(await routeRedirects('checkout', { user: { tuxarVerified: true }, isLoading: false }), []);
  assert.deepEqual(await routeRedirects('checkout', { user: { tuxarVerified: false }, isLoading: false }), [{ to: '/en/verify-email', returnTo: '/en/checkout' }]);
});
