import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('lapel coats are local image-only drafts in women Leather Fur Jackets', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const products = catalogue.products.filter(product => product.batchId === 'womens-lapel-fur-01');
  assert.equal(products.length, 3);
  assert.deepEqual(products.map(product => product.colors[0].name), ['Black', 'Brown', 'Tan']);
  for (const field of ['slug', 'name', 'description']) assert.equal(new Set(products.map(product => product[field])).size, 3);
  for (const product of products) {
    assert.deepEqual(product.collections, ['leather-fur-jackets']);
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.priceGBP, 249);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.match(product.description, /composition.*confirmation/);
    assert.doesNotMatch(product.description, /duty.free|genuine fur|waterproof/i);
    assert.equal(product.gallery.length, 1);
    const image = product.gallery[0];
    assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
    const bytes = await fs.readFile(image.slice(1));
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    if (product.colors[0].name !== 'Brown') assert.match(product.description, /front|Front/);
  }
});
