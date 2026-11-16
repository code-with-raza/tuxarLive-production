import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

async function evaluate(path, modules) {
  const source = await fs.readFile(path, 'utf8');
  modules["@/lib/storefront-products"] ??= { getStorefrontProducts: async () => modules["@/data/products"]?.PRODUCTS ?? [] };
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in modules, `Unexpected module ${name}`);
    return modules[name];
  } });
  return exports;
}
const dictionaries = {};
for (const locale of ['en', 'it', 'de', 'fr', 'es']) dictionaries[`./locales/${locale}.json`] = { default: JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`, 'utf8')) };
const i18n = await evaluate('src/i18n/i18n.ts', { ...dictionaries, '@tanstack/react-router': { redirect: value => value }, '@/lib/catalogue-preview-edits': { previewCollection: collection => collection } });
const { COLLECTIONS } = await evaluate('src/data/product-types.ts', { '@/assets': { getProductAsset: value => value } });
const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8')).products;
const renamed = {
  'women-varsity-jackets': 'Leather Hood Jackets',
  'women-aviator-jackets': 'Leather Round Jackets',
  'women-puffer-jackets': 'Cat Top Jacket',
  'women-shearling-jackets': 'zipper jacket',
  'women-racing-jackets': 'sperade collar jacket',
  'women-motorcycle-suits': 'Motorcycle Tops',
};

test('missing collection translations use saved content, not humanized old slugs or Description labels', () => {
  // This is the actual failure mode: t() returns a readable label, not its raw key.
  assert.equal(i18n.t('collections.women-varsity-jackets.title', 'en'), 'Leather Hood Jackets');
  assert.notEqual(i18n.t('collections.women-varsity-jackets.description', 'en'), 'Description');
  for (const locale of i18n.SUPPORTED_LOCALES) for (const collection of COLLECTIONS) {
    const localized = i18n.getLocalizedCollection(collection, locale);
    for (const field of ['title', 'description', 'metaIntro', 'seoContent']) {
      const expected = dictionaries[`./locales/${locale}.json`].default.collections?.[collection.slug]?.[field]
        ?? dictionaries['./locales/en.json'].default.collections?.[collection.slug]?.[field] ?? collection[field];
      assert.equal(localized[field], expected, `${locale}/${collection.slug}/${field}`);
    }
  }
});

test('actual collection loader, heading, breadcrumbs and SEO use all six renamed titles in every locale', async () => {
  let params, loaderData;
  const audience = await evaluate('src/lib/product-audience.ts', {});
  const modules = {
    '@tanstack/react-router': { createFileRoute: () => options => ({ ...options, useParams: () => params, useLoaderData: () => loaderData }), notFound: () => new Error('Not found'), Link: ({ children }) => React.createElement('a', null, children) },
    'react/jsx-runtime': jsxRuntime,
    '@/components/site/ProductCard': { ProductCard: ({ p }) => React.createElement('article', { 'data-product': p.slug }, p.name) },
    '@/components/site/PageHero': { PageHero: ({ title, description }) => React.createElement('header', null, React.createElement('h1', null, title), React.createElement('p', null, description)) },
    '@/components/site/Reveal': { Reveal: ({ children }) => React.createElement('div', null, children) },
    '@/components/site/Breadcrumbs': { Breadcrumbs: ({ items }) => React.createElement('nav', null, items.map(item => item.label).join(' > ')) },
    '@/i18n/i18n': i18n,
    '@/data/products': { COLLECTIONS, PRODUCTS: [...women, ...men] },
    '@/lib/seo': { absoluteUrl: path => `https://tuxar.co.uk${path}`, localizedAlternates: () => [] },
    '@/lib/product-audience': audience,
  };
  const { Route } = await evaluate('src/routes/$locale.collections.$slug.tsx', modules);
  for (const locale of i18n.SUPPORTED_LOCALES) for (const [slug, englishTitle] of Object.entries(renamed)) {
    const title = dictionaries[`./locales/${locale}.json`].default.collections[slug].title;
    if (locale === 'en') assert.equal(title, englishTitle);
    params = { locale, slug };
    loaderData = await Route.loader({ params });
    assert.equal(loaderData.collection.title, title);
    assert.equal(loaderData.comingSoon, false);
    assert.ok(loaderData.products.length > 0);
    assert.ok(loaderData.products.every(product => audience.isProductForAudience(product, 'women')));
    const html = renderToStaticMarkup(React.createElement(Route.component));
    assert.ok(html.includes(`<h1>${title}</h1>`), `${locale}/${slug}: heading`);
    assert.ok(html.includes(`${title}</nav>`), `${locale}/${slug}: breadcrumb`);
    assert.ok(!html.includes('<p>Description</p>'));
    const head = Route.head({ loaderData, params });
    assert.ok(head.meta.find(meta => meta.title)?.title.includes(title));
    assert.equal(head.meta.find(meta => meta.name === 'description').content, loaderData.collection.metaIntro);
  }
});
