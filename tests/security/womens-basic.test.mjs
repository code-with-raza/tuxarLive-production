import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('all five women leather folders are local image-only drafts with distinct copy', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  const products = catalogue.products.filter(product => product.batchId === 'womens-basic-leather-01');
  assert.equal(products.length, 19);
  assert.equal(new Set(products.map(product => product.itemGroupId)).size, 5);
  assert.equal(products.flatMap(product => product.gallery).length, 32);
  for (const field of ['slug', 'name', 'description']) assert.equal(new Set(products.map(product => product[field])).size, 19);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  for (const product of products) {
    assert.equal(product.audience, 'women');
    assert.deepEqual(product.collections, product.itemGroupId === 'TX-WL-2' ? ['women-leather-jackets', 'women-motorcycle-suits'] : product.itemGroupId === 'TX-WL-3' ? ['women-leather-jackets', 'women-shearling-jackets'] : product.itemGroupId === 'TX-WL-5' ? ['women-leather-jackets', 'women-varsity-jackets'] : ['women-leather-jackets']);
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|CE.certified|MotoGP|waterproof/i);
    for (const image of product.gallery) {
      assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
      const bytes = await fs.readFile(image.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('audience filtering separates every legacy menswear product and women draft', async () => {
  const source = await fs.readFile('src/lib/product-audience.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports });
  const matches = exports.isProductForAudience;
  const men = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json', 'utf8')).products;
  const women = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8')).products;
  for (const product of men) { assert.equal(matches(product, 'men'), true); assert.equal(matches(product, 'women'), false); }
  for (const product of women) { assert.equal(matches(product, 'women'), true); assert.equal(matches(product, 'men'), false); }
  assert.equal(matches({ slug: 'neutral', name: 'Neutral', audience: 'women' }, 'men'), false);
  assert.equal(matches({ slug: 'neutral', name: 'Neutral', audience: 'women' }, 'women'), true);
  assert.equal(matches({ slug: 'neutral', name: 'Neutral', audience: 'both' }, 'women'), true);
  const menRoute = await fs.readFile('src/routes/$locale.leather-jackets.tsx', 'utf8');
  const womenRoute = await fs.readFile('src/routes/$locale.women-leather-jackets.tsx', 'utf8');
  const view = await fs.readFile('src/components/site/CategoryView.tsx', 'utf8');
  assert.match(menRoute, /audience="men"/);
  assert.match(womenRoute, /audience="women"/);
  assert.match(view, /isProductForAudience\(p, audience\)/);
});

test('desktop and mobile menu data link to separate all-jacket pages and the women simple edit', async () => {
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  const functions = header.slice(header.indexOf('function menLinks('), header.indexOf('// ─── Announcement bar'));
  const code = ts.transpileModule(functions + '\nexports.men=menLinks; exports.women=womenLinks;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, getLocalizedSlug: value => value });
  assert.equal(exports.men('en').col1.find(link => link.label === 'All Leather Jackets').to, '/en/leather-jackets');
  assert.equal(exports.women('en').col1.find(link => link.label === 'All Leather Jackets').to, '/en/women-leather-jackets');
  assert.equal(exports.women('en').col1.find(link => link.label === 'Leather Jackets').params.slug, 'women-leather-jackets');
  assert.match(header, /women\.col1\.map/);
});
