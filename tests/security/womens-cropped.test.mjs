import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('women cropped drafts have unique copy, image-only galleries and no invented inventory or publication', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  catalogue.products = catalogue.products.filter(product => product.batchId === 'womens-cropped-01');
  assert.equal(catalogue.products.length, 8);
  for (const key of ['slug', 'name', 'description']) assert.equal(new Set(catalogue.products.map(product => product[key])).size, 8);
  const images = catalogue.products.flatMap(product => product.gallery);
  assert.equal(images.length, 17);
  for (const image of images) {
    assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/womens-[a-z0-9-]+\.webp$/);
    const bytes = await fs.readFile(image.slice(1));
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const product of catalogue.products) {
    assert.deepEqual(product.collections, ['cropped-jackets']);
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.equal(product.rating, 0);
    assert.ok([169, 189].includes(product.priceGBP));
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|lambskin|cowhide|certified|waterproof/i);
  }
});
