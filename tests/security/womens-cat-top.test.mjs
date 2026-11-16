import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Cat Top Jacket contains three women-only local drafts and all five images', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const products = catalogue.products.filter(product => product.collections.includes('women-puffer-jackets'));
  assert.equal(products.length, 3);
  assert.equal(products.flatMap(product => product.gallery).length, 5);
  assert.deepEqual(products.map(product => product.colors[0].name).sort(), ['Black', 'Pink', 'White']);
  assert.equal(new Set(products.map(product => product.description)).size, 3);
  for (const product of products) {
    assert.equal(product.batchId, 'womens-cat-top-01');
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.equal(product.priceGBP, 219);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|lambskin|sheepskin|waterproof|puffer/i);
    if (product.colors[0].name !== 'White') {
      assert.equal(product.gallery.length, 1);
      assert.match(product.description, /Only the (rear model|back product) photograph is available/);
    }
    for (const path of product.gallery) {
      assert.match(path, /\.webp$/);
      const bytes = await fs.readFile(path.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});
