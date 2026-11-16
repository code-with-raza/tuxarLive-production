import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('women round jackets contain five colourways and seven clean images as local-only drafts', async () => {
  const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(new Set(catalogue.products.map(product => product.slug)).size, catalogue.products.length);
  const products = catalogue.products.filter(product => product.collections.includes('women-aviator-jackets'));
  assert.equal(products.length, 5);
  assert.deepEqual(products.map(product => product.colors[0].name).sort(), ['Black', 'Brown', 'Burgundy', 'Red', 'Tan']);
  assert.equal(products.flatMap(product => product.gallery).length, 7);
  assert.equal(new Set(products.map(product => product.description)).size, 5);
  for (const product of products) {
    assert.equal(product.batchId, 'womens-round-jackets-01');
    assert.deepEqual(product.collections, ['women-aviator-jackets']);
    assert.equal(product.audience, 'women');
    assert.equal(product.cataloguePreview, true);
    assert.equal(product.inStock, false);
    assert.deepEqual(product.sizes, []);
    assert.equal(product.priceGBP, 179);
    assert.equal(product.reviewCount, 0);
    assert.ok(product.seoTitle.length <= 60);
    assert.ok(product.seoDescription.length <= 160);
    assert.doesNotMatch(product.description, /duty.free|sheepskin|lambskin|waterproof/i);
    for (const path of product.gallery) {
      const bytes = await fs.readFile(path.slice(1));
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
  const black = products.find(product => product.colors[0].name === 'Black');
  assert.match(black.description, /Only the back photograph is available/);
  assert.equal(black.gallery.length, 1);
});

test('round jacket importer guards source integrity and rejects the promotional duplicate', async () => {
  const importer = await fs.readFile('scripts/import-womens-round-jackets.mjs', 'utf8');
  assert.match(importer, /assert\.notEqual\(id, 8,/);
  assert.match(importer, /assert\.equal\(imageMap\.length, 7\)/);
  assert.match(importer, /assert\.equal\(createHash\('sha256'\)\.update\(await fs\.readFile\(source\)\)\.digest\('hex'\), hash\)/);
});
