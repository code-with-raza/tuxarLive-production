import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Motorcycle Tops combines both women folders without duplicating existing products', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const tops = catalogue.products.filter(product => product.collections.includes('women-motorcycle-suits'));
  assert.equal(tops.length, 8);
  const additions = tops.filter(product => product.batchId === 'womens-motorcycle-tops-01');
  const reused = tops.filter(product => product.itemGroupId === 'TX-WL-2');
  assert.equal(additions.length, 4);
  assert.equal(reused.length, 4);
  assert.ok(reused.every(product => product.collections.includes('women-leather-jackets')));
  assert.equal(additions.flatMap(product => product.gallery).length, 8);
  assert.equal(new Set(additions.map(product => product.description)).size, 4);
  for (const product of tops) {
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.priceGBP, 189);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    for (const path of product.gallery) {
      const bytes = await fs.readFile(path.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
  for (const product of additions) assert.match(product.description, /Not verified motorcycle protective clothing/);
});
