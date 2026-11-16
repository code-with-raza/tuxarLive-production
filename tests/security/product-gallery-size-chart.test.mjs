import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

async function evaluate(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {}, URL });
  return exports;
}
const categories = await evaluate('src/lib/catalogCategories.ts');
const audiences = await evaluate('src/lib/product-audience.ts');
const charts = await evaluate('src/lib/size-chart-assets.ts');
const { galleryWithSizeChart } = await evaluate('src/lib/product-size-chart.ts', { './catalogCategories': categories, './product-audience': audiences, './size-chart-assets': charts });

test('every men and women jacket has its matching chart last without mutating catalogue photos', async () => {
  for (const [file, expected] of [['approved-catalogue', charts.MENS_JACKET_SIZE_CHART], ['local-womens-jackets', charts.WOMENS_JACKET_SIZE_CHART]]) {
    const { products } = JSON.parse(await fs.readFile(`src/data/products/${file}.json`, 'utf8'));
    for (const product of products) {
      const original = [...product.gallery];
      const gallery = galleryWithSizeChart(product);
      assert.equal(gallery.at(-1), expected, product.slug);
      assert.deepEqual(Array.from(gallery.slice(0, -1)), original);
      assert.deepEqual(product.gallery, original);
      const again = galleryWithSizeChart({ ...product, gallery });
      assert.equal(again.filter(image => image === expected).length, 1);
      assert.equal(again.at(-1), expected);
    }
  }
});

test('bags, accessories and suits retain their galleries and empty galleries retain the primary photo', () => {
  for (const category of ['leather-bags', 'accessories', 'motorcycle-suits']) {
    const product = { slug: 'test', name: 'Test', category, image: '/front.webp', gallery: ['/front.webp', '/back.webp'] };
    assert.deepEqual(Array.from(galleryWithSizeChart(product)), product.gallery);
  }
  const gallery = galleryWithSizeChart({ slug: 'womens-test', name: "Women's Jacket", category: 'leather-jackets', image: '/front.webp', gallery: [] });
  assert.equal(gallery[0], '/front.webp');
  assert.equal(gallery.at(-1), charts.WOMENS_JACKET_SIZE_CHART);
});

test('legacy and wrong-audience charts are replaced by one current chart at the end', () => {
  const gallery = galleryWithSizeChart({ slug: 'womens-test', name: "Women's Jacket", category: 'leather-jackets', image: '/front.webp', gallery: ['/size-charts/mens-jackets.webp', '/front.webp', '/size-charts/womens-jackets.webp', charts.MENS_JACKET_SIZE_CHART, charts.WOMENS_JACKET_SIZE_CHART] });
  assert.deepEqual(Array.from(gallery), ['/front.webp', charts.WOMENS_JACKET_SIZE_CHART]);
});

test('both charts ship with the website and the women chart matches the supplied original', async () => {
  for (const filename of ['mens-jackets.webp', 'womens-jackets.webp']) {
    const bytes = await fs.readFile(`public/size-charts/${filename}`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  assert.equal(createHash('sha256').update(await fs.readFile('public/size-charts/womens-jackets.webp')).digest('hex'), '4494abfd88ab069f3a2314399f509c17c8cc2ea21d6f7f26f104fe2800eac167');
});
