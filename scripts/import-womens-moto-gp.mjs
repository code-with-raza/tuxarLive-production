import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-moto-gp-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const existing = preserved.filter(product => product.batchId === 'womens-riding-coats-01' && ['TX-WRC-4', 'TX-WRC-5'].includes(product.itemGroupId));
assert.equal(existing.length, 8, 'The two previously imported folders must retain their eight products');
for (const product of existing) {
  product.audience = 'women';
  product.collections = [...new Set([...product.collections, 'women-motorcycle-jackets'])];
}
const inventory = JSON.parse(await fs.readFile('output/womens-moto-gp/inventory.json', 'utf8'));
const safety = 'Motorcycle-inspired fashion outerwear. Protective equipment and CE/UKCA certification are unverified; do not rely on this garment as motorcycle protective clothing.';
const designs = [
  { colour: 'Black / White', hex: '#171717', key: 'black-white', views: [[1, 'front'], [2, 'back']], description: 'A black leather motorcycle-style jacket outlined with white shoulder stripes and shaped side panels. The front shows a tab collar, central zip and angled waist pockets; the rear photograph shows the contrasting panels following the waist and upper arms. Compare both views for the panel layout.' },
  { colour: 'Black / Red', hex: '#171717', key: 'black-red', views: [[3, 'back']], description: 'Black leather and red contrast panels create a fitted motorcycle-inspired outline. The rear product photograph shows red shoulder stripes, side panels and forearm sections, with shaped seams through the back. Only the rear view is available for this colourway; front fastening and pocket details are not confirmed.' },
  { colour: 'Black / Yellow', hex: '#171717', key: 'black-yellow', views: [[5, 'three-quarter'], [4, 'back']], description: 'Yellow contrast panels stand out against the black body of this motorcycle-style jacket. A tab collar and front zip sit above angled waist pockets, while the shoulder stripes continue over the back. The rear and three-quarter photographs show the shaped waist, sleeve panels and quilted-looking shoulder sections.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.key}-contour-stripe-motorcycle-leather-jacket`;
  const name = `Women's ${design.colour.replace(' / ', ' & ')} Contour-Stripe Motorcycle-Style Jacket`;
  assert(!preserved.some(product => product.slug === slug), 'Slug collision');
  const gallery = [];
  for (const [id, view] of design.views) {
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
    const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
  }
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Contour contrast panels · Motorcycle-inspired style`, category: 'leather-jackets', priceGBP: 239,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; panel composition unconfirmed', weight: '', rating: 0, reviewCount: 0,
    description: `${design.description} ${safety}`,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }, { label: 'Safety', value: safety }],
    inStock: false, collections: ['women-motorcycle-jackets'], itemGroupId: 'TX-WMGP-01',
    seoTitle: `Women's ${design.colour.replace(' / ', ' & ')} Moto-Style Jacket | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase().replace(' / ', ' and ')} leather jacket with contrast stripes and shaped panels. View photographs at Tuxar. Protective certification is unverified.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 5);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/shop/womens/clothing/coats-and-jackets/f/material-leather-style-biker';
const source = catalogue.pricingSources.find(source => source.url === url);
if (source && !source.observed.includes('Contour-stripe fashion draft')) source.observed += ' Contour-stripe fashion draft proposed at £239; not a protective-equipment price comparison.';
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-moto-gp-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: additions.length, newImages: imageMap.length, existingProductsRetained: existing.length, categoryProducts: catalogue.products.filter(product => product.collections.includes('women-motorcycle-jackets')).length, videosImported: 0, localOnly: true, networkWrites: 0 }));
