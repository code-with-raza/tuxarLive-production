import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
assert.equal(catalogue.localOnly, true);
const batchId = 'womens-zipper-jackets-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-zipper-jackets/inventory.json', 'utf8'));
const designs = [
  { colour: 'Red', hex: '#b42b29', views: [[2, 'front'], [1, 'model-front']], description: 'A red collared leather jacket with a central zip and long shaped front panels. The pointed collar frames the neckline above a fitted waist and short hem. Product and model-front photographs show the straight fastening and the jacket worn open with blue jeans.' },
  { colour: 'Brown', hex: '#654332', views: [[3, 'front'], [4, 'back']], description: 'Brown leather tones give this pointed-collar zipper jacket a warm finish. The front photograph shows a central zip and long seams following the body. The back view reveals a horizontal shoulder yoke and vertical panels shaping the waist above a gently curved lower edge.' },
  { colour: 'Black', hex: '#171717', views: [[6, 'front'], [5, 'model-front']], description: 'A black leather zipper jacket with a pointed collar and clean central fastening. Long front panels create a fitted outline through the waist, with simple sleeves and a short hem. The model-front view shows the jacket worn open over a dark top and blue jeans.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-collared-zipper-leather-jacket`;
  const name = `Women's ${design.colour} Collared Zipper Leather Jacket`;
  assert(!preserved.some(product => product.slug === slug), 'Slug collision');
  const gallery = [];
  for (const [id, view] of design.views) {
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.png$/i.test(source), 'Images only, never videos');
    const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
  }
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Pointed collar · Central zip`, category: 'leather-jackets', priceGBP: 199,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: design.description,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Pointed collar, central zip and shaped panels' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-shearling-jackets'], itemGroupId: 'TX-WZJ-01',
    seoTitle: `Women's ${design.colour} Collared Zipper Jacket | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase()} collared leather jacket with a central zip and shaped seams. View available photographs at Tuxar. Sizing awaiting confirmation.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 6);
catalogue.products = [...preserved, ...additions];
// Proposed draft price follows the existing local collared leather edit, not a discount or market average.
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-zipper-jackets-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ products: additions.length, images: imageMap.length, videosImported: 0, localOnly: true, networkWrites: 0 }));
