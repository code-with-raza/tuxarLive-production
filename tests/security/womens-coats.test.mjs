import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('women Leather Coats includes both folders without duplicating hooded products', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const coats = catalogue.products.filter(product => product.collections.includes('women-leather-coats') && ['womens-fur-01', 'womens-leather-coats-01'].includes(product.batchId));
  assert.equal(coats.length, 5);
  const hooded = coats.filter(product => product.itemGroupId === 'TX-WF-3');
  assert.equal(hooded.length, 3);
  assert.equal(hooded.flatMap(product => product.gallery).length, 6);
  for (const product of hooded) {
    assert.ok(product.collections.includes('leather-fur-jackets'));
    assert.ok(product.collections.includes('best-sellers'));
    assert.equal(catalogue.products.filter(other => other.slug === product.slug).length, 1);
  }
  const additions = coats.filter(product => product.batchId === 'womens-leather-coats-01');
  assert.equal(additions.length, 2);
  assert.equal(additions.flatMap(product => product.gallery).length, 3);
  for (const product of coats) {
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|genuine fur|European hides/i);
    for (const image of product.gallery) {
      assert.match(image, /\.webp$/);
      const bytes = await fs.readFile(image.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
  const header = await fs.readFile('src/components/site/Header.tsx', 'utf8');
  assert.match(header, /label: "Leather Coats", \.\.\.col\("women-leather-coats"\)/);
});
