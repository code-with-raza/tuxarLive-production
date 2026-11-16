import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
assert.equal(catalogue.localOnly, true);
const batchId = 'womens-cat-top-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-cat-top/inventory.json', 'utf8'));
const designs = [
  { colour: 'Pink', hex: '#e884ad', views: [[1, 'model-back']], description: 'A pink leather jacket shown from the rear on a model, with a hood topped by pointed cat-ear details. Long back seams follow the fitted waist above a short hem. Only the rear model photograph is available for this colourway; front fastening, pockets and hood lining are unconfirmed.' },
  { colour: 'Black', hex: '#171717', views: [[2, 'back']], description: 'A black leather jacket with a cat-ear hood, shown from the rear. Shaped back panels define the waist, while visible metal zips finish the sleeve cuffs. Only the back product photograph is available; front fastening, pocket layout and hood lining are unconfirmed for this colourway.' },
  { colour: 'White', hex: '#eeeae4', views: [[5, 'three-quarter'], [3, 'model-front'], [4, 'model-back']], description: 'A white leather cat-ear hood jacket with wide lapels and an angled front zip. Zipped waist pockets and shaped seams frame the fitted body, while the hood has a contrasting textured lining whose composition is unconfirmed. Front and rear model photographs show the short silhouette with white trousers.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-cat-ear-hood-leather-jacket`;
  const name = `Women's ${design.colour} Cat-Ear Hood Leather Jacket`;
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
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Cat-ear hood · Shaped panels`, category: 'leather-jackets', priceGBP: 219,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; hood lining and composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: design.description,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Cat-ear hood and shaped body panels' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-puffer-jackets'], itemGroupId: 'TX-WCT-01',
    seoTitle: `Women's ${design.colour} Cat-Ear Hood Leather Jacket | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase()} cat-ear hood leather jacket with shaped seams. View available photographs at Tuxar. Sizing and hood lining awaiting confirmation.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 5);
catalogue.products = [...preserved, ...additions];
// Proposed local draft price; supplier costs, margin and availability are unconfirmed.
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-cat-top-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ products: additions.length, images: imageMap.length, videosImported: 0, localOnly: true, networkWrites: 0 }));
