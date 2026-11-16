import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Reuse the original Zip-up fashion folder's drafts; no remote writes or duplicates.
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
assert.equal(catalogue.localOnly, true);
const products = catalogue.products.filter(product => product.batchId === 'womens-basic-leather-01' && product.itemGroupId === 'TX-WL-3');
assert.equal(products.length, 3);
assert.equal(products.flatMap(product => product.gallery).length, 5);
for (const product of products) {
  assert.equal(product.audience, 'women');
  product.collections = [...new Set([...product.collections, 'women-shearling-jackets'])];
}
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
console.log(JSON.stringify({ productsReused: products.length, images: 5, duplicateProductsAdded: 0, localOnly: true, networkWrites: 0 }));
