import { marketStub } from './helpers/market-stub.mjs';
import { relatedProducts, recommendationFamily, recommendationStyle } from '../../src/lib/related-products.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

async function evaluate(path, modules) {
  modules["@/lib/storefront-products"] ??= { getStorefrontProducts: async () => modules["@/data/products"]?.PRODUCTS ?? [] };
  const exports = {};
  const code = ts.transpileModule(await fs.readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {}, URL });
  return exports;
}
const router = { createFileRoute: () => options => options, notFound: () => new Error('Not found') };
const dictionaries = {};
for (const locale of ['en', 'it', 'de', 'fr', 'es']) dictionaries[`./locales/${locale}.json`] = { default: JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`, 'utf8')) };
const i18n = await evaluate('src/i18n/i18n.ts', { ...dictionaries, '@/lib/catalogue-preview-edits': { previewCollection: collection => collection } });
const seo = await evaluate('src/lib/seo.ts', { '@/i18n/i18n': i18n });
const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8')).products;
const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
const { COLLECTIONS, CATEGORY_META } = await evaluate('src/data/product-types.ts', { '@/assets': { getProductAsset: value => value } });
const audience = await evaluate('src/lib/product-audience.ts', {});
const recommendations = { relatedProducts };
const modules = { '@/lib/market': marketStub, '@tanstack/react-router': router, '@/i18n/i18n': i18n, '@/lib/seo': seo, '@/lib/product-audience': audience, '@/data/products': { COLLECTIONS, CATEGORY_META, PRODUCTS: [...men, ...women] }, '@/lib/local-catalogue': { getLocalCatalogueProduct: slug => women.find(product => product.slug === slug) } };

test('real product loader keeps all four recommendations within the product audience in every locale', async () => {
  const approvedWomen = JSON.parse(await fs.readFile('src/data/products/approved-womens-catalogue.json','utf8')).products;
  const catalogue = [...men, ...approvedWomen];
  const { Route } = await evaluate('src/routes/$locale.product.$slug.tsx', {...modules,
    '@/lib/related-products': recommendations,
    '@/data/products': {...modules['@/data/products'], PRODUCTS: catalogue, getProductBySlug: slug => catalogue.find(product => product.slug === slug)},
  });
  for (const product of catalogue) for (const locale of i18n.SUPPORTED_LOCALES) {
    const group = audience.isProductForAudience(product,'women') ? 'women' : 'men';
    const result = await Route.loader({params:{locale,slug:i18n.getLocalizedSlug(product.slug,'product',locale)}});
    assert.equal(result.related.length,4,product.slug);
    assert.equal(new Set(result.related.map(recommendationFamily)).size,4);
    assert.equal(new Set(result.related.map(recommendationStyle)).size,4,product.slug);
    for (const related of result.related) {
      assert.notEqual(related.slug,product.slug);
      assert.notEqual(recommendationFamily(related),recommendationFamily(product));
      assert.ok(audience.isProductForAudience(catalogue.find(item => item.slug===related.slug),group), `${product.slug}: ${related.slug}`);
      assert.equal(related.category,product.category);
    }
  }
});

test('recommendations vary by opened product, are stable across rerenders and do not depend on catalogue ordering',async()=>{
  const approvedWomen = JSON.parse(await fs.readFile('src/data/products/approved-womens-catalogue.json','utf8')).products;
  const catalogue=[...men,...approvedWomen], fingerprints=new Set();
  for(const product of catalogue){
    const result=relatedProducts(product,catalogue).map(item=>item.slug);
    assert.deepEqual(result,relatedProducts(product,[...catalogue].reverse()).map(item=>item.slug));
    fingerprints.add(result.join('|'));
  }
  assert.ok(fingerprints.size > catalogue.length/2,`${fingerprints.size} unique lists`);
  const lone=men[0];
  assert.deepEqual(relatedProducts(lone,[lone,{...lone,slug:'same-design-another-colour'}]),[]);
});

test('product canonicals and offer URLs use the canonical localized slug, never a visited alias', async () => {
  const { Route } = await evaluate('src/routes/$locale.product.$slug.tsx', modules);
  const product = { ...men[0], slug: 'monaco-leather-racer' };
  for (const locale of i18n.SUPPORTED_LOCALES) {
    const head = Route.head({ loaderData: { product }, params: { locale, slug: 'old-or-wrong-language-alias' } });
    const expected = seo.absoluteUrl(`/${locale}/product/${i18n.getLocalizedSlug(product.slug, 'product', locale)}`);
    assert.equal(head.links.filter(link => link.rel === 'canonical').length, 1);
    assert.equal(head.links.find(link => link.rel === 'canonical').href, expected);
    assert.equal(head.meta.find(meta => meta.property === 'og:url').content, expected);
    const structured = JSON.parse(head.scripts[0].children);
    assert.equal(structured.offers.url, expected);
    assert.equal(structured.offers.priceCurrency, locale === 'en' ? 'GBP' : 'EUR');
    assert.equal(structured.aggregateRating, undefined);
  }
});

test('unpublished draft products are noindex and do not advertise a purchasable structured-data offer', async () => {
  const { Route } = await evaluate('src/routes/$locale.product.$slug.tsx', modules);
  const product = women[0];
  const head = Route.head({ loaderData: { product }, params: { locale: 'en', slug: product.slug } });
  assert.match(head.meta.find(meta => meta.name === 'robots').content, /noindex/);
  assert.equal(JSON.parse(head.scripts[0].children).offers, undefined);
});

test('collection aliases canonicalize correctly and local draft collections remain noindex with social metadata', async () => {
  const { Route } = await evaluate('src/routes/$locale.collections.$slug.tsx', modules);
  for (const slug of ['biker-jackets', 'women-varsity-jackets']) {
    const collection = COLLECTIONS.find(item => item.slug === slug);
    const draft = slug.startsWith('women-');
    const products = draft ? women.filter(product => product.collections.includes(slug)) : [men[0]];
    const head = Route.head({ loaderData: { collection, products, comingSoon: false }, params: { locale: 'fr', slug: 'old-collection-alias' } });
    const expected = seo.absoluteUrl(`/fr/collections/${i18n.getLocalizedSlug(slug, 'collection', 'fr')}`);
    assert.equal(head.links.find(link => link.rel === 'canonical').href, expected);
    assert.equal(head.meta.find(meta => meta.property === 'og:url').content, expected);
    assert.match(head.meta.find(meta => meta.property === 'og:image').content, /^https:\/\//);
    assert.equal(head.meta.find(meta => meta.name === 'twitter:image').content, head.meta.find(meta => meta.property === 'og:image').content);
    assert.equal(Boolean(head.meta.find(meta => meta.name === 'robots')?.content.includes('noindex')), draft);
  }
});

test('internal shop searches are noindex while the main shop remains indexable', async () => {
  const { Route } = await evaluate('src/routes/$locale.shop.tsx', { ...modules, zod: await import('zod') });
  for (const q of [undefined, '', 'black leather']) {
    const head = Route.head({ params: { locale: 'en' }, match: { search: { q } } });
    assert.equal(Boolean(head.meta.find(meta => meta.name === 'robots')?.content.includes('noindex')), Boolean(q));
    assert.equal(head.links.find(link => link.rel === 'canonical').href, 'https://tuxar.co.uk/en/shop');
  }
});

test('runtime error pages explicitly prevent indexing', async () => {
  const source = await fs.readFile('src/routes/__root.tsx', 'utf8');
  const error = source.slice(source.indexOf('function ErrorComponent'), source.indexOf('export const Route'));
  assert.match(error, /robots\.content = "noindex, nofollow"/);
});

test('legacy category pages have metadata and canonicalize to their matching collection', async () => {
  const { Route } = await evaluate('src/routes/$locale.$category.tsx', modules);
  const head = Route.head({ params: { locale: 'en', category: 'women-varsity-jackets' }, match: { search: {} } });
  assert.equal(head.meta.find(meta => meta.title).title, 'Leather Hood Jackets | Tuxar');
  assert.equal(head.links[0].href, 'https://tuxar.co.uk/en/collections/women-leather-hood-jackets');
  assert.ok(head.meta.find(meta => meta.name === 'description').content.length > 50);
});
