import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-motorcycle-tops-01';
// Preserve the original peplum listings and their Leather Jackets membership.
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const existing = preserved.filter(product => product.batchId === 'womens-basic-leather-01' && product.itemGroupId === 'TX-WL-2');
assert.equal(existing.length, 4);
for (const product of existing) product.collections = [...new Set([...product.collections, 'women-motorcycle-suits'])];
const inventory = JSON.parse(await fs.readFile('output/womens-motorcycle-tops/inventory.json', 'utf8'));
const safety = 'Fashion top; protective equipment and CE/UKCA certification are unverified. Not verified motorcycle protective clothing.';
const designs = [
  { colour: 'Burgundy', hex: '#682c35', views: [[1, 'front'], [2, 'three-quarter']], description: 'A burgundy collarless leather top with a gold-tone central zip and two patch chest pockets. Vertical seams follow the fitted body above a defined waist seam and short flared hem. Front and three-quarter photographs show the smooth sleeves and peplum shape.' },
  { colour: 'Black', hex: '#171717', views: [[5, 'three-quarter'], [4, 'back'], [3, 'model-back']], description: 'Black leather and gold-tone hardware define this collarless zip-front top. The front shows two patch chest pockets, with shaped seams meeting the waist above a flared lower edge. Product and model back views show the panelled waist and peplum hem.' },
  { colour: 'Red', hex: '#b42b29', views: [[7, 'three-quarter'], [6, 'model-back']], description: 'A red leather top with a central gold-tone zip, round neckline and patch chest pockets. A horizontal waist seam separates the fitted upper body from the short peplum flare. The rear model photograph shows the shaped back seams and curved lower edge.' },
  { colour: 'Brown', hex: '#654332', views: [[8, 'model-front']], description: 'This brown leather top is shown from the front on a model with light trousers. A collarless neckline, gold-tone zip and patch chest pockets sit above a shaped waist and flared hem. Only the model-front photograph is available for this colourway.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-waist-seam-zip-peplum-leather-top`;
  const name = `Women's ${design.colour} Waist-Seam Zip Leather Top`;
  assert(!preserved.some(product => product.slug === slug));
  const gallery = [];
  for (const [id, view] of design.views) {
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.png$/i.test(source));
    const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
  }
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Zip front · Shaped peplum hem`, category: 'leather-jackets', priceGBP: 189,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: `${design.description} ${safety}`,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }, { label: 'Safety', value: safety }],
    inStock: false, collections: ['women-motorcycle-suits'], itemGroupId: 'TX-WMT-01',
    seoTitle: `Women's ${design.colour} Zip Leather Top | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase()} collarless leather top with a gold-tone zip, chest pockets and peplum hem. View photographs at Tuxar. Fashion design, not verified riding PPE.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 8);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.angeljackets.com/uk/products/womens-asymmetrical-peplum-leather-jacket.html';
if (!catalogue.pricingSources.some(source => source.url === url)) catalogue.pricingSources.push({ url, observed: 'UK retailer peplum leather jacket listed at £159 on sale when researched. Different design; qualitative reference only. Tuxar zip-top draft proposed at £189, matching its existing gathered-waist peplum draft, not a market average or discount claim.', checked: '2026-10-25' });
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-motorcycle-tops-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: additions.length, newImages: imageMap.length, existingProductsReused: existing.length, categoryProducts: catalogue.products.filter(product => product.collections.includes('women-motorcycle-suits')).length, localOnly: true, networkWrites: 0 }));
