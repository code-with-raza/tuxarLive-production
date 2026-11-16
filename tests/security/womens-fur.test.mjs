import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('fur drafts retain all four families, Featured membership and clean image-only galleries', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  const products = catalogue.products.filter(product => product.batchId === 'womens-fur-01');
  assert.equal(products.length, 15);
  assert.equal(new Set(products.map(product => product.itemGroupId)).size, 4);
  assert.equal(products.flatMap(product => product.gallery).length, 30);
  for (const key of ['slug', 'name', 'description']) assert.equal(new Set(products.map(product => product[key])).size, 15);
  for (const product of products) {
    assert.deepEqual(product.collections, ['leather-fur-jackets', 'best-sellers', ...(product.itemGroupId === 'TX-WF-3' ? ['women-leather-coats'] : [])]);
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.equal(product.rating, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.match(product.description, /composition.*confirmation/);
    assert.doesNotMatch(product.description, /duty.free|genuine fur|fox fur|sheepskin|waterproof/i);
    for (const image of product.gallery) {
      assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
      const bytes = await fs.readFile(image.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('renamed menu link resolves to a collection without removing Cropped Jackets', async () => {
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  assert.match(header, /label: "LEATHER FUR JACKETS", \.\.\.col\("leather-fur-jackets"\)/);
  assert.doesNotMatch(header, /label: "Crop Leather Jackets"/);
  assert.match(header, /label: "Cropped Leather Jackets", \.\.\.col\("cropped-jackets"\)/);
  const source = await fs.readFile('src/data/product-types.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => ({ getProductAsset: value => value }) });
  assert.equal(exports.COLLECTIONS.filter(collection => collection.slug === 'leather-fur-jackets').length, 1);
  assert.ok(exports.COLLECTIONS.some(collection => collection.slug === 'cropped-jackets'));
});
