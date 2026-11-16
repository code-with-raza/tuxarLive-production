import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('long slim coats add three women-only drafts while retaining all twelve existing coats', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const coats = catalogue.products.filter(product => product.collections.includes('women-leather-coats'));
  assert.equal(coats.length, 15);
  const products = coats.filter(product => product.batchId === 'womens-long-slim-coats-01');
  assert.equal(products.length, 3);
  assert.equal(products.flatMap(product => product.gallery).length, 4);
  assert.deepEqual(products.map(product => product.colors[0].name).sort(), ['Black', 'Brown', 'Red']);
  assert.equal(new Set(products.map(product => product.description)).size, 3);
  for (const product of products) {
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.equal(product.priceGBP, 249);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|lambskin|waterproof/i);
    if (product.colors[0].name !== 'Black') {
      assert.equal(product.gallery.length, 1);
      assert.match(product.description, /front fastening and pocket details are unconfirmed/i);
    }
    for (const path of product.gallery) {
      const bytes = await fs.readFile(path.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
  const importer = await fs.readFile('scripts/import-womens-long-slim-coats.mjs', 'utf8');
  assert.match(importer, /assert\(!\[5, 6, 7\]\.includes\(id\)/);
});
