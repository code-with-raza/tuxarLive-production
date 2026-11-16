import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import vm from 'node:vm';

const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile('src/data/cloudinary-assets.json', 'utf8'));
const inventory = JSON.parse(await fs.readFile('src/data/womens-inventory.json', 'utf8'));
const paths = [...new Set(catalogue.products.flatMap(product => [product.image, ...product.gallery]))];

test('all 167 women photos have verified Cloudinary mappings matching the original bytes', async () => {
  assert.equal(paths.length, 167);
  for (const source of paths) {
    const entry = manifest[source];
    assert.ok(entry, source);
    const url = new URL(entry.url);
    assert.equal(url.origin, 'https://res.cloudinary.com');
    assert.ok(url.pathname.startsWith('/rllwk4bi/image/upload/'));
    assert.ok(url.pathname.endsWith('/' + source.split('/').at(-1)));
    const bytes = await fs.readFile(source.slice(1));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.verifiedSha256);
    assert.equal(entry.width, 1000);
    assert.equal(entry.height, 1250);
  }
  const sample = paths.find(source => source.endsWith('womens-yellow-black-contrast-panel-motorcycle-leather-jacket-model-front.webp'));
  assert.ok(manifest[sample].url.includes('/v1793050561/'));
});

test('unapproved preview fixtures use verified remote photos and retain draft ordering guards', async () => {
  const source = await fs.readFile('src/lib/local-catalogue.ts', 'utf8');
  const men = JSON.parse(await fs.readFile('src/data/products/local-jackets.json', 'utf8'));
  const load = (dev, ssr) => {
    const exports = {};
    const code = ts.transpileModule(source.replaceAll('import.meta.env.DEV', String(dev)).replaceAll('import.meta.env.SSR', String(ssr)), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => {
      if (name === '@/assets') return { getProductAsset: path => { assert.ok(manifest[path]); return manifest[path].url; } };
      if (name === '@/data/womens-inventory.json') return { default: inventory };
      if (name === '@/data/products/approved-womens-catalogue.json') return { default: { products: [] } };
      if (name === '@/lib/catalogue-preview-edits') return { previewProduct: product => product };
      if (name === '@/data/products/local-bags.json') return { default: { products: [] } };
      if (name.endsWith('local-womens-jackets.json')) return { default: catalogue };
      if (name.endsWith('local-jackets.json')) return { default: men };
      throw Error(name);
    } });
    return exports.LOCAL_JACKET_PRODUCTS;
  };
  assert.equal(load(false, false).length, 0);
  assert.equal(load(true, true).length, 0);
  const products = load(true, false).filter(product => product.audience === 'women');
  assert.equal(products.length, catalogue.products.length);
  for (const product of products) {
    const original = catalogue.products.find(candidate => candidate.slug === product.slug);
    assert.equal(product.image, manifest[original.image].url);
    assert.deepEqual(Array.from(product.gallery), original.gallery.map(path => manifest[path].url));
    assert.equal(product.inStock, original.inStock);
    assert.deepEqual(Array.from(product.sizes), inventory.sizes);
    assert.equal(product.previewStockPerSize, 15);
    assert.deepEqual(Array.from(product.collections), original.collections);
  }
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
});
