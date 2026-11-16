import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('zipper jacket collection has three women colourways and six images as local-only drafts', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const category = catalogue.products.filter(product => product.collections.includes('women-shearling-jackets'));
  assert.equal(category.length, 6);
  assert.equal(category.flatMap(product => product.gallery).length, 11);
  const reused = category.filter(product => product.itemGroupId === 'TX-WL-3');
  assert.equal(reused.length, 3);
  assert.ok(reused.every(product => product.collections.includes('women-leather-jackets') && product.audience === 'women'));
  assert.ok(reused.every(product => product.cataloguePreview === true && !product.inStock && product.sizes.length === 0));
  const products = category.filter(product => product.batchId === 'womens-zipper-jackets-01');
  assert.equal(products.length, 3);
  assert.equal(products.flatMap(product => product.gallery).length, 6);
  assert.deepEqual(products.map(product => product.colors[0].name).sort(), ['Black', 'Brown', 'Red']);
  assert.equal(new Set(products.map(product => product.description)).size, 3);
  for (const product of products) {
    assert.equal(product.batchId, 'womens-zipper-jackets-01');
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.equal(product.priceGBP, 199);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|lambskin|shearling|waterproof/i);
    for (const path of product.gallery) {
      assert.match(path, /\.webp$/);
      const bytes = await fs.readFile(path.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});
