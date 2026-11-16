import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('all three supplied motorcycle folders share the women collection without duplicated products', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const products = catalogue.products.filter(product => product.collections.includes('women-motorcycle-jackets'));
  assert.equal(products.length, 11);
  assert.equal(products.flatMap(product => product.gallery).length, 20);
  assert.equal(products.filter(product => product.itemGroupId === 'TX-WRC-4').length, 5);
  assert.equal(products.filter(product => product.itemGroupId === 'TX-WRC-5').length, 3);
  const additions = products.filter(product => product.batchId === 'womens-moto-gp-01');
  assert.equal(additions.length, 3);
  assert.equal(additions.flatMap(product => product.gallery).length, 5);
  for (const key of ['slug', 'name', 'description']) assert.equal(new Set(additions.map(product => product[key])).size, 3);
  for (const product of products) {
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.match(product.description, /do not rely.*protective clothing/);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    for (const image of product.gallery) {
      assert.match(image, /\/womens-[a-z0-9-]+\.webp$/);
      assert.equal((await fs.readFile(image.slice(1))).toString('ascii', 8, 12), 'WEBP');
    }
  }
});
