import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('five requested folders add women biker, coat and motorcycle-style drafts with images only', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  const products = catalogue.products.filter(product => product.batchId === 'womens-riding-coats-01');
  assert.equal(products.length, 19);
  assert.equal(new Set(products.map(product => product.itemGroupId)).size, 5);
  assert.equal(products.flatMap(product => product.gallery).length, 36);
  for (const [collection, count] of [['women-biker-jackets', 4], ['women-leather-coats', 7], ['women-motorcycle-jackets', 8]]) {
    assert.equal(products.filter(product => product.collections.includes(collection)).length, count);
  }
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  for (const field of ['slug', 'name', 'description']) assert.equal(new Set(products.map(product => product[field])).size, 19);
  for (const product of products) {
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60, product.seoTitle);
    assert.ok(product.seoDescription.length <= 160, product.seoDescription);
    assert.doesNotMatch(product.description, /duty.free|genuine fur|waterproof|certified protection/i);
    if (!product.collections.includes('women-leather-coats')) assert.match(product.description, /do not rely.*protective clothing/);
    for (const image of product.gallery) {
      assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
      const bytes = await fs.readFile(image.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('women biker/motorcycle menus and collection audience guards remain separate from men', async () => {
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  const functions = header.slice(header.indexOf('function menLinks('), header.indexOf('// ─── Announcement bar'));
  const code = ts.transpileModule(functions + '\nexports.men=menLinks; exports.women=womenLinks;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const menus = {};
  vm.runInNewContext(code, { exports: menus, getLocalizedSlug: value => value });
  assert.equal(menus.men('en').col1.find(link => link.label === 'Biker Jackets').params.slug, 'biker-jackets');
  assert.equal(menus.women('en').col1.find(link => link.label === 'Biker Jackets').params.slug, 'women-biker-jackets');
  assert.equal(menus.men('en').col1.find(link => link.label === 'Motorbike Jackets').params.slug, 'motorcycle-jackets');
  assert.equal(menus.women('en').col1.find(link => link.label === 'Motorcycle Jackets').params.slug, 'women-motorcycle-jackets');
  const audienceCode = ts.transpileModule(await fs.readFile('src/lib/product-audience.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const audience = {};
  vm.runInNewContext(audienceCode, { exports: audience });
  for (const slug of ['women-biker-jackets', 'women-motorcycle-jackets', 'women-leather-coats']) assert.equal(audience.collectionAudience(slug), 'women');
  for (const slug of ['biker-jackets', 'motorcycle-jackets']) assert.equal(audience.collectionAudience(slug), 'men');
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  for (const product of catalogue.products) assert.equal(audience.isProductForAudience(product, 'men'), false);
  const route = await fs.readFile('src/routes/$locale.collections.$slug.tsx', 'utf8');
  assert.match(route, /collectionAudience\(canonicalSlug\)/);
  assert.match(route, /isProductForAudience\(p, audience\)/);
});
