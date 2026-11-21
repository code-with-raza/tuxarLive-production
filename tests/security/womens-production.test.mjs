import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

await import('../../scripts/prepare-womens-supabase.mjs');
await import('../../scripts/prepare-womens-production.mjs');
const women = JSON.parse(await fs.readFile('src/data/products/approved-womens-catalogue.json', 'utf8'));
const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8'));
const rawWomen = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
const rawMen = JSON.parse(await fs.readFile('src/data/products/local-jackets.json', 'utf8'));
const inventory = JSON.parse(await fs.readFile('src/data/womens-inventory.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile('src/data/cloudinary-assets.json', 'utf8'));
const assetModule = { getProductAsset: source => manifest[source]?.url ?? source };

async function evaluate(file, modules = {}, dev = false) {
  const source = (await fs.readFile(file, 'utf8')).replaceAll('import.meta.env.DEV', String(dev)).replaceAll('import.meta.env.SSR', 'false');
  modules["@/lib/storefront-products"] ??= { getStorefrontProducts: async () => modules["@/data/products"]?.PRODUCTS ?? [] };
  modules["@/lib/storefront-collection-content"] ??= { getStorefrontCollectionContent: async collection => collection };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, URL, require: name => modules[name] ?? {} });
  return exports;
}
const localModules = {
  '@/data/products/local-bags.json': { default: { products: [] } },
  '@/data/products/local-jackets.json': { default: rawMen },
  '@/data/products/local-womens-jackets.json': { default: rawWomen },
  '@/data/products/approved-womens-catalogue.json': { default: women },
  '@/data/womens-inventory.json': { default: inventory },
  '@/assets': assetModule, '@/lib/catalogue-preview-edits': { previewProduct: product => product },
};
const local = await evaluate('src/lib/local-catalogue.ts', localModules);
const types = await evaluate('src/data/product-types.ts', { '@/assets': assetModule });
const seeds = {};
for (const name of ['jackets', 'suits', 'bags', 'accessories']) seeds[`./products/${name}`] = await evaluate(`src/data/products/${name}.ts`, { '@/assets': assetModule });
const production = await evaluate('src/data/products.ts', {
  ...seeds, './product-types': types, '@/lib/local-catalogue': local,
  './products/approved-bags-catalogue.json': { default: JSON.parse(await fs.readFile('src/data/products/approved-bags-catalogue.json','utf8')) },
  './products/approved-catalogue.json': { default: men }, './products/approved-womens-catalogue.json': { default: women },
});

test('production exposes all 252 products once; approved women are never local drafts', async () => {
  assert.equal(inventory.pricesApproved, true);
  assert.equal(production.PRODUCTS.length, 252);
  assert.equal(new Set(production.PRODUCTS.map(product => product.slug)).size, 252);
  const dev = await evaluate('src/lib/local-catalogue.ts', localModules, true);
  for (const product of women.products) {
    const published = production.getProductBySlug(product.slug);
    assert.equal(published.audience, 'women');
    assert.equal(published.cataloguePreview, undefined);
    assert.equal(dev.getLocalCatalogueProduct(product.slug), undefined);
    assert.equal(published.priceGBP, rawWomen.products.find(raw => raw.slug === product.slug).priceGBP);
    assert.deepEqual(Array.from(published.sizes), inventory.sizes);
  }
  const repaired = production.getProductBySlug('classic-zip-quilted');
  assert.equal(repaired.image, 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793051072/classic-zip-new.webp');
});

test('populated approved women collections are visible and contain no men products', async () => {
  const audience = await evaluate('src/lib/product-audience.ts');
  const { Route } = await evaluate('src/routes/$locale.collections.$slug.tsx', {
    '@tanstack/react-router': { createFileRoute: () => options => options, notFound: () => Error('Unknown collection') },
    '@/data/products': production, '@/lib/product-audience': audience,
    '@/i18n/i18n': { resolveSlug: slug => slug, getLocalizedCollection: collection => collection },
  });
  for (const slug of new Set(women.products.flatMap(product => product.collections))) {
    const collection = production.COLLECTIONS.find(collection => audience.collectionAudience(collection.slug) === 'women' && (collection.slug === slug || collection.sourceCollection === slug));
    assert.ok(collection, slug);
    const result = await Route.loader({ params: { locale: 'en', slug: collection.slug } });
    assert.equal(result.comingSoon, false, slug);
    assert.ok(result.products.length > 0, slug);
    assert.ok(result.products.every(product => product.audience === 'women'), slug);
  }
  const menResult = await Route.loader({ params: { locale: 'en', slug: 'biker-jackets' } });
  assert.ok(menResult.products.every(product => product.audience !== 'women'));
});

test('activation validates drafts atomically and reruns never reset sold stock or prices', async context => {
  const db = new PGlite();
  context.after(() => db.close());
  const schema = (await fs.readFile('supabase/migrations/202609130003_catalog_content.sql', 'utf8')).split('create table if not exists public.blog_posts')[0];
  await db.exec(schema);
  await db.exec(`create table public.product_categories(slug text primary key,status text);
    insert into public.product_categories values('leather-jackets','active');
    insert into public.products(slug,name,category,price_pence,status) values('classic-zip-quilted','Existing men jacket','classic',20000,'active');
    insert into public.product_variants(product_id,sku,size,color,stock) select id,'KEEP-MEN-STOCK','M','Black',7 from public.products;`);
  await db.exec(await fs.readFile('output/supabase-womens-release/02-STAGE-94-WOMENS-PRODUCTS.sql', 'utf8'));
  const activation = await fs.readFile('output/womens-production/04-ACTIVATE-94-WOMENS-PRODUCTS.sql', 'utf8');
  const first = women.products[0];
  await db.query(`update public.product_variants set stock=14 where product_id=(select id from public.products where slug=$1) and size='S'`, [first.slug]);
  await assert.rejects(() => db.exec(activation), /inventory or variant price differs/);
  await db.exec('rollback');
  assert.equal((await db.query(`select count(*)::int n from public.products where status='draft'`)).rows[0].n, 94);
  await db.query(`update public.product_variants set stock=15 where product_id=(select id from public.products where slug=$1) and size='S'`, [first.slug]);
  await db.query(`update public.products set price_pence=1 where slug=$1`, [first.slug]);
  await assert.rejects(() => db.exec(activation), /staged price differs/);
  await db.exec('rollback');
  await db.query(`update public.products set price_pence=$1 where slug=$2`, [Math.round(first.priceGBP * 100), first.slug]);
  await db.exec(activation);
  assert.equal((await db.query(`select count(*)::int n from public.products where status='active'`)).rows[0].n, 95);
  await db.query(`update public.product_variants set stock=14 where product_id=(select id from public.products where slug=$1) and size='S'`, [first.slug]);
  await db.query(`update public.products set price_pence=19800 where slug=$1`, [first.slug]);
  await db.exec(activation);
  assert.equal((await db.query(`select stock from public.product_variants where product_id=(select id from public.products where slug=$1) and size='S'`, [first.slug])).rows[0].stock, 14);
  assert.equal((await db.query(`select price_pence from public.products where slug=$1`, [first.slug])).rows[0].price_pence, 19800);
  assert.equal((await db.query(`select stock from public.product_variants where sku='KEEP-MEN-STOCK'`)).rows[0].stock, 7);
});
