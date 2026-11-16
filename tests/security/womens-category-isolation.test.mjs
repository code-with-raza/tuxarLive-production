import { storefrontManagedCategories } from '../../src/lib/catalogCategories.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

function evaluate(source, context = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, ...context });
  return exports;
}

test('every women menu collection resolves to a women-only listing, never men catalogue images', async () => {
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  const functions = header.slice(header.indexOf('function menLinks('), header.indexOf('// ─── Announcement bar'));
  const menus = evaluate(functions + '\nexports.men=menLinks; exports.women=womenLinks;', { getLocalizedSlug: value => value });
  const { COLLECTIONS } = evaluate(await fs.readFile('src/data/product-types.ts', 'utf8'), { require: () => ({ getProductAsset: value => value }) });
  const audience = evaluate(await fs.readFile('src/lib/product-audience.ts', 'utf8'));
  assert.equal(new Set(COLLECTIONS.map(collection => collection.slug)).size, COLLECTIONS.length);
  const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8')).products;
  const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
  const all = [...men, ...women];
  const select = slug => {
    const collection = COLLECTIONS.find(item => item.slug === slug);
    assert.ok(collection, `Missing collection: ${slug}`);
    const sourceSlug = collection.sourceCollection ?? slug;
    return all.filter(product => (product.collections?.includes(slug) || product.collections?.includes(sourceSlug)) && audience.isProductForAudience(product, audience.collectionAudience(slug)));
  };
  for (const link of Object.values(menus.women('en')).flat()) {
    if (!link.params) { assert.equal(link.to, '/en/women-leather-jackets'); continue; }
    const slug = link.params.slug;
    assert.equal(audience.collectionAudience(slug), 'women', slug);
    for (const product of select(slug)) {
      assert.equal(audience.isProductForAudience(product, 'women'), true);
      assert.equal(audience.isProductForAudience(product, 'men'), false);
      assert.ok(women.some(woman => woman.slug === product.slug));
    }
  }
  assert.equal(select('women-suede-jackets').length, 3);
  assert.equal(select('women-puffer-jackets').length, 3);
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-puffer-jackets').title, 'Cat Top Jacket');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-puffer-jackets').sourceCollection, undefined);
  assert.equal(menus.women('en').col1.find(link => link.label === 'Cat Top Jacket').params.slug, 'women-puffer-jackets');
  assert.equal(menus.men('en').col1.find(link => link.label === 'Puffer Jackets').params.slug, 'puffer-jackets');
  assert.equal(select('women-leather-coats').length, 15);
  assert.equal(select('women-shearling-jackets').length, 6);
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-shearling-jackets').title, 'zipper jacket');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-shearling-jackets').sourceCollection, undefined);
  assert.equal(menus.women('en').col1.find(link => link.label === 'zipper jacket').params.slug, 'women-shearling-jackets');
  assert.equal(menus.men('en').col1.find(link => link.label === 'Shearling Jackets').params.slug, 'shearling-jackets');
  assert.equal(audience.getAudienceCollection('shearling-jackets', 'Shearling Jackets', 'men', COLLECTIONS).slug, 'shearling-jackets');
  assert.equal(select('women-racing-jackets').length, 4);
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-racing-jackets').title, 'sperade collar jacket');
  assert.equal(menus.women('en').col1.find(link => link.label === 'sperade collar jacket').params.slug, 'women-racing-jackets');
  assert.equal(audience.getAudienceCollection('racing', 'Racing', 'women', COLLECTIONS).slug, 'women-racing-jackets');
  assert.equal(audience.getAudienceCollection('racing-jackets', 'Racing', 'men', COLLECTIONS).slug, 'racing-jackets');
  assert.equal(select('women-aviator-jackets').length, 5);
  assert.equal(select('women-varsity-jackets').length, 4);
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-varsity-jackets').title, 'Leather Hood Jackets');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-varsity-jackets').sourceCollection, undefined);
  assert.equal(menus.women('en').col1.find(link => link.label === 'Leather Hood Jackets').params.slug, 'women-varsity-jackets');
  assert.equal(menus.men('en').col1.find(link => link.label === 'Varsity Jackets').params.slug, 'varsity-jackets');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-aviator-jackets').title, 'Leather Round Jackets');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-aviator-jackets').sourceCollection, undefined);
  assert.equal(menus.women('en').col1.find(link => link.label === 'Leather Round Jackets').params.slug, 'women-aviator-jackets');
  assert.equal(menus.men('en').col1.find(link => link.label === 'Aviator Jackets').params.slug, 'aviator-jackets');
  assert.ok(select('aviator-jackets').every(product => audience.isProductForAudience(product, 'men')));
  const suedeCollection = COLLECTIONS.find(collection => collection.slug === 'women-suede-jackets');
  assert.equal(suedeCollection.sourceCollection, undefined);
  assert.ok(select('women-suede-jackets').every(product => product.batchId === 'womens-suede-01'));
  assert.equal(catalogueSuedeAliases(COLLECTIONS), 0);
  assert.equal(select('women-best-sellers').length, 15);
  assert.ok(select('suede-jackets').length > 0);
  assert.ok(select('suede-jackets').every(product => audience.isProductForAudience(product, 'men')));
  assert.ok(select('best-sellers').every(product => audience.isProductForAudience(product, 'men')));
  assert.ok(menus.men('en').col1.some(link => link.label === 'Motorbike Suits'));
  assert.ok(!Object.values(menus.women('en')).flat().some(link => link.to === '/en/motorcycle-suits'));
  assert.equal(menus.women('en').col1.find(link => link.label === 'Motorcycle Tops').params.slug, 'women-motorcycle-suits');
  assert.equal(COLLECTIONS.find(collection => collection.slug === 'women-motorcycle-suits').title, 'Motorcycle Tops');
  assert.equal(select('women-motorcycle-suits').length, 8);
  assert.ok(header.includes('storefrontManagedCategories(managedCategories, audience)'));
  assert.deepEqual(storefrontManagedCategories([{slug:'men-only',audience:'men'},{slug:'women-only',audience:'women'},{slug:'shared',audience:'both'}], 'women').map(row=>row.slug), ['women-only','shared']);
  assert.match(header, /search:audience==="women"\?\{audience:"women" as const\}/);
  for (const slug of ['women-leather-bags', 'women-accessories']) {
    assert.ok(COLLECTIONS.some(collection => collection.slug === slug));
    assert.equal(select(slug).length, 0);
  }
  assert.match(header, /getAudienceCollection\(category\.slug, category\.name, audience, COLLECTIONS\)/);
  assert.match(header, /getLocalizedSlug\(collection\.slug, "collection", activeLocale as Locale\)/);
  assert.equal((header.match(/search=\{link\.search as any\}/g) ?? []).length, 2);
  const dynamic = await fs.readFile('src/routes/$locale.$category.tsx', 'utf8');
  assert.match(dynamic, /isProductForAudience\(product, inferredAudience\)/);
  assert.match(dynamic, /search\.audience === "women" \|\| search\.audience === "men"/);
  assert.match(dynamic, /draft\.collections\?\.includes\(draftCollection\?\.slug \?\? category\)/);
});

function catalogueSuedeAliases(collections) {
  return collections.filter(collection => collection.slug === 'women-suede-jackets' && collection.sourceCollection === 'suede-jackets').length;
}

test('women suede colourways use all six images and remain unpublished with unconfirmed inventory', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  const products = catalogue.products.filter(product => product.batchId === 'womens-suede-01');
  assert.equal(products.length, 3);
  assert.deepEqual(products.map(product => product.colors[0].name), ['Tan', 'Black', 'Grey']);
  assert.equal(products.flatMap(product => product.gallery).length, 6);
  for (const key of ['slug', 'name', 'description']) assert.equal(new Set(products.map(product => product[key])).size, 3);
  for (const product of products) {
    assert.equal(product.audience, 'women');
    assert.deepEqual(product.collections, ['women-suede-jackets']);
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    for (const image of product.gallery) {
      assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
      assert.equal((await fs.readFile(image.slice(1))).toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('actual managed Suede and Motorcycle categories render women drafts when database has zero category rows', async () => {
  const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
  const men = JSON.parse(await fs.readFile('src/data/products/local-jackets.json', 'utf8')).products;
  const products = [...men, ...women];
  const { COLLECTIONS } = evaluate(await fs.readFile('src/data/product-types.ts', 'utf8'), { require: () => ({ getProductAsset: value => value }) });
  const audienceHelpers = evaluate(await fs.readFile('src/lib/product-audience.ts', 'utf8'));
  const categories = evaluate(await fs.readFile('src/lib/catalogCategories.ts', 'utf8'));
  const source = await fs.readFile('src/routes/$locale.$category.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [category, audience, expected] of [['suede-jackets', 'women', 3], ['legacy-suede-id', 'women', 3], ['suede-jackets', 'men', 10], ['motorcycle-jackets', 'women', 11], ['women-motorcycle-jackets', 'women', 11], ['women-motorcycle-suits', 'women', 8], ['motorcycle-tops', 'women', 8], ['women-aviator-jackets', 'women', 5], ['legacy-aviator-id', 'women', 5], ['varsity', 'women', 4], ['women-varsity-jackets', 'women', 4], ['racing', 'women', 4], ['women-racing-jackets', 'women', 4], ['women-shearling-jackets', 'women', 6], ['legacy-shearling-id', 'women', 6], ['women-puffer-jackets', 'women', 3], ['legacy-puffer-id', 'women', 3], ['legacy-puffer-no-audience', undefined, 3]]) {
    const states = [], effects = [];
    let stateIndex = 0;
    const exports = {};
    const record = { slug: category, name: category.includes('puffer') ? 'Women Puffer Jackets' : category.includes('shearling') ? 'Women Shearling Jackets' : category.includes('racing') ? 'Racing' : category.includes('varsity') ? 'Varsity' : category.includes('aviator') ? 'Women Aviator Jackets' : /suits|tops/.test(category) ? 'Motorcycle Tops' : category.includes('motorcycle') ? 'MotorCycle Jackets' : 'Suede Jackets', audience: 'both', show_hero: true, show_product_count: true, show_filters: true };
    const modules = {
      '@tanstack/react-router': { createFileRoute: () => options => ({ ...options, useParams: () => ({ locale: 'en', category }), useSearch: () => ({ audience }) }) },
      react: { useState: initial => { const index = stateIndex++; if (index >= states.length) states.push(initial); return [states[index], value => { states[index] = value; }]; }, useEffect: effect => effects.push(effect) },
      'react/jsx-runtime': jsxRuntime,
      '@/components/site/PageHero': { PageHero: ({ title }) => React.createElement('h1', null, title) },
      '@/components/site/ProductCard': { ProductCard: ({ p }) => React.createElement('article', { 'data-product': p.slug }, p.name, React.createElement('img', { src: p.image, alt: p.name })) },
      '@/data/products': { PRODUCTS: products, COLLECTIONS },
      '@/lib/supabase': { supabase: { from: table => table === 'product_categories'
        ? { select: () => ({ eq() { return this; }, maybeSingle: async () => ({ data: record }) }) }
        : { select: () => ({ in: () => ({ eq: async () => ({ data: [] }) }) }) } } },
      '@/lib/cloudinary': { cloudinaryUrl: url => url },
      '@/lib/catalogCategories': categories,
      '@/lib/local-catalogue': { LOCAL_JACKET_PRODUCTS: products },
      '@/lib/product-audience': audienceHelpers,
      '@/i18n/i18n': {},
      '@/lib/seo': {},
      '@/lib/catalogue-preview-edits': { previewCollection: collection => collection },
    };
    vm.runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
    exports.Route.component();
    effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(states[2], false, 'Loading completes');
    assert.equal(states[1].length, expected);
    assert.ok(states[1].every(product => audienceHelpers.isProductForAudience(product, audience ?? 'women')));
    stateIndex = 0;
    const html = renderToStaticMarkup(exports.Route.component());
    assert.equal((html.match(/data-product=/g) ?? []).length, expected);
    assert.ok(!html.includes('No active products are assigned'));
    if (category.includes('puffer')) {
      assert.ok(html.includes('Cat Top Jacket'));
      assert.ok(!html.includes('Women Puffer Jackets'));
      assert.ok(states[1].every(product => product.batchId === 'womens-cat-top-01'));
    }
    if (category.includes('shearling')) {
      assert.ok(html.includes('zipper jacket'));
      assert.ok(!html.includes('Women Shearling Jackets'));
      assert.ok(states[1].every(product => product.batchId === 'womens-zipper-jackets-01' || product.itemGroupId === 'TX-WL-3'));
    }
    if (category.includes('racing')) {
      assert.ok(html.includes('sperade collar jacket'));
      assert.ok(!html.includes('Racing'));
      assert.ok(states[1].every(product => product.batchId === 'womens-spread-collar-01'));
    }
    if (category.includes('varsity')) {
      assert.ok(html.includes('Leather Hood Jackets'));
      assert.ok(!html.includes('Varsity'));
      assert.ok(states[1].every(product => product.itemGroupId === 'TX-WL-5'));
      assert.ok(states[1].every(product => product.collections.includes('women-leather-jackets')));
      assert.equal(states[1].flatMap(product => product.gallery).length, 6);
    }
    if (category.includes('aviator')) {
      assert.ok(html.includes('Leather Round Jackets'));
      assert.ok(!html.includes('Women Aviator Jackets'));
      assert.ok(states[1].every(product => product.batchId === 'womens-round-jackets-01'));
    }
    if (audience === 'women' && category.includes('suede')) {
      assert.ok(states[1].every(product => product.batchId === 'womens-suede-01'));
      assert.ok(html.includes("Suede Jackets"));
    }
  }
});
