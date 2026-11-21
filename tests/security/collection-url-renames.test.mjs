import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

async function evaluate(path, modules = {}) {
  modules["@/lib/storefront-products"] ??= { getStorefrontProducts: async () => modules["@/data/products"]?.PRODUCTS ?? [] };
  modules["@/lib/storefront-collection-content"] ??= { getStorefrontCollectionContent: async collection => collection };
  const exports = {};
  const code = ts.transpileModule(await fs.readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {} });
  return exports;
}
const renamed = {
  'women-varsity-jackets': 'women-leather-hood-jackets',
  'women-aviator-jackets': 'women-leather-round-jackets',
  'women-puffer-jackets': 'women-cat-top-jacket',
  'women-shearling-jackets': 'women-zipper-jacket',
  'women-racing-jackets': 'women-sperade-collar-jacket',
  'women-motorcycle-suits': 'women-motorcycle-tops',
};
const dictionaries = {};
for (const locale of ['en', 'it', 'de', 'fr', 'es']) dictionaries[`./locales/${locale}.json`] = { default: JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`, 'utf8')) };
const router = { createFileRoute: () => options => options, redirect: value => value, notFound: () => new Error('Not found') };
const i18n = await evaluate('src/i18n/i18n.ts', { ...dictionaries, '@tanstack/react-router': router, '@/lib/catalogue-preview-edits': { previewCollection: collection => collection } });
const { COLLECTIONS } = await evaluate('src/data/product-types.ts', { '@/assets': { getProductAsset: value => value } });
const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
const audience = await evaluate('src/lib/product-audience.ts');
const modules = { '@tanstack/react-router': router, '@/i18n/i18n': i18n, '@/data/products': { COLLECTIONS, PRODUCTS: women }, '@/lib/product-audience': audience };

test('all renamed public URLs resolve to stable catalogue IDs and retain their products', async () => {
  const { Route } = await evaluate('src/routes/$locale.collections.$slug.tsx', modules);
  for (const locale of i18n.SUPPORTED_LOCALES) for (const [id, english] of Object.entries(renamed)) {
    const current = locale === 'en' ? english : i18n.COLLECTION_SLUG_MAP[id][locale];
    assert.equal(i18n.getLocalizedSlug(id, 'collection', locale), current);
    assert.equal(i18n.resolveSlug(current, 'collection', locale), id);
    assert.doesNotThrow(() => Route.beforeLoad({ params: { locale, slug: current } }));
    const data = await Route.loader({ params: { locale, slug: current } });
    assert.equal(data.collection.slug, id);
    assert.equal(data.comingSoon, false);
    assert.equal(data.products.length, women.filter(product => product.collections.includes(id)).length);
    assert.ok(data.products.length > 0);
  }
});

test('old collection and direct-category URLs redirect once, preserving language and query parameters', async () => {
  const collection = await evaluate('src/routes/$locale.collections.$slug.tsx', modules);
  const category = await evaluate('src/routes/$locale.$category.tsx', modules);
  for (const locale of i18n.SUPPORTED_LOCALES) for (const [old, english] of Object.entries(renamed)) {
    const current = locale === 'en' ? english : i18n.COLLECTION_SLUG_MAP[old][locale];
    for (const [route, params] of [[collection.Route, { locale, slug: old }], [category.Route, { locale, category: old }]]) {
      assert.throws(() => route.beforeLoad({ params }), redirect => {
        assert.equal(redirect.statusCode, 301);
        assert.equal(redirect.to, '/$locale/collections/$slug');
        assert.equal(redirect.params.locale, locale);
        assert.equal(redirect.params.slug, current);
        assert.equal(redirect.search, true);
        assert.equal(redirect.replace, true);
        return true;
      });
    }
  }
  for (const slug of ['puffer-jackets', 'varsity-jackets', 'shearling-jackets', 'aviator-jackets', 'racing-jackets']) {
    assert.equal(i18n.getLocalizedSlug(slug, 'collection', 'en'), slug);
    assert.doesNotThrow(() => collection.Route.beforeLoad({ params: { locale: 'en', slug } }));
  }
});

test('actual women menu uses the new addresses rather than old category handles', async () => {
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  const functions = header.slice(header.indexOf('function menLinks('), header.indexOf('// ─── Announcement bar'));
  const exports = {};
  const code = ts.transpileModule(functions + '\nexports.women=womenLinks;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, getLocalizedSlug: i18n.getLocalizedSlug });
  for (const locale of i18n.SUPPORTED_LOCALES) {
    const links = Object.values(exports.women(locale)).flat();
    for (const [old, english] of Object.entries(renamed)) {
      const current = locale === 'en' ? english : i18n.COLLECTION_SLUG_MAP[old][locale];
      assert.ok(links.some(link => link.params?.slug === current), current);
      assert.ok(!links.some(link => link.params?.slug === old), old);
    }
  }
});

test('cPanel has non-looping permanent redirects for every old localized and unlocalized URL', async () => {
  const config = await fs.readFile('public/.htaccess', 'utf8');
  const rules = config.split(/\r?\n/).filter(line => line.includes('women-') && line.includes('[R=301,L,NE]')).map(line => {
    const match = line.trim().match(/^RewriteRule (\S+) (\S+) \[R=301,L,NE\]$/);
    assert.ok(match, line);
    return { pattern: new RegExp(match[1]), target: match[2] };
  });
  assert.ok(rules.length >= 12);
  for (const [old, current] of Object.entries(renamed)) for (const locale of i18n.SUPPORTED_LOCALES) {
    for (const prefix of [`${locale}/collections/`, `${locale}/`, 'collections/', '']) {
      const path = `${prefix}${old}`;
      const rule = rules.find(rule => rule.pattern.test(path));
      assert.ok(rule, path);
      const target = path.replace(rule.pattern, rule.target);
      const targetLocale = prefix.startsWith(`${locale}/`) ? locale : 'en';
      const localizedSlug = targetLocale === 'en' ? current : i18n.COLLECTION_SLUG_MAP[old][targetLocale];
      assert.equal(target, `https://tuxar.co.uk/${targetLocale}/collections/${localizedSlug}`);
      assert.ok(!rules.some(rule => rule.pattern.test(new URL(target).pathname.slice(1))));
    }
  }
});
