import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const bags = JSON.parse(fs.readFileSync('src/data/products/local-bags.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('src/data/cloudinary-assets.json', 'utf8'));
const source = fs.readFileSync('src/lib/local-catalogue.ts', 'utf8');
function load(dev, ssr) {
  const exports = {};
  const code = ts.transpileModule(source.replaceAll('import.meta.env.DEV', String(dev)).replaceAll('import.meta.env.SSR', String(ssr)), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === '@/lib/catalogue-preview-edits') return { previewProduct: p => p };
    if (name === '@/assets') return { getProductAsset: p => manifest[p]?.url ?? p };
    if(name === '@/data/products/local-bags.json') return { default: { ...bags, pricesApproved: false, publishReady: false } };
    assert.ok(name.startsWith('@/data/') && name.endsWith('.json'), name);
    return { default: JSON.parse(fs.readFileSync('src/' + name.slice(2), 'utf8')) };
  } });
  return exports;
}

test('an unapproved bag fixture retains grouped galleries, confirmed stock and draft ordering protection', () => {
  const dev = load(true, false);
  assert.equal(bags.products.length, 11);
  assert.equal(bags.pricesApproved, true);
  assert.equal(bags.publishReady, true);
  assert.equal(bags.products.reduce((n, p) => n + p.gallery.length, 0), 15);
  assert.deepEqual(bags.products.map(p => p.gallery.length), [1, 3, 1, 1, 1, 2, 1, 1, 2, 1, 1]);
  for (const p of bags.products) {
    const draft = dev.getLocalCatalogueProduct(p.slug);
    assert.equal(draft.category, 'leather-bags');
    assert.equal(draft.cataloguePreview, true);
    assert.equal(draft.previewStockPerSize, 11);
    assert.equal(draft.inStock, false);
    assert.equal(draft.pricingStatus, 'proposed');
    assert.ok(draft.priceGBP >= 109 && draft.priceGBP <= 219);
    assert.equal(draft.image, draft.gallery[0]);
    for (const [index, image] of draft.gallery.entries()) {
      const mapping = manifest[p.gallery[index]];
      assert.equal(image, mapping.url);
      assert.match(image, /^https:\/\/res\.cloudinary\.com\/rllwk4bi\/image\/upload\//);
      const bytes = fs.readFileSync(p.gallery[index].slice(1));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, 1000);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, 1250);
    }
  }
});

test('unapproved bag fixtures stay outside production and SSR; existing draft ordering guard applies', () => {
  for (const [dev, ssr] of [[false, false], [true, true], [false, true]]) {
    const module = load(dev, ssr);
    for (const bag of bags.products) assert.equal(module.getLocalCatalogueProduct(bag.slug), undefined);
  }
  const page = fs.readFileSync('src/routes/$locale.product.$slug.tsx', 'utf8');
  const add = page.slice(page.indexOf('function handleAdd()'), page.indexOf('const safeQty', page.indexOf('function handleAdd()')));
  assert.match(add, /getLocalCatalogueProduct\(canonicalSlug\)/);
  assert.match(add, /return;/);
  assert.match(page, /disabled=\{Boolean\(getLocalCatalogueProduct\(canonicalSlug\)\)/);
});
