import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
assert.equal(catalogue.localOnly, true);
const batchId = 'womens-long-slim-coats-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-long-slim-coats/inventory.json', 'utf8'));
const designs = [
  { colour: 'Black', hex: '#171717', views: [[1, 'model-front'], [2, 'back']], description: 'A black longline leather coat with notched lapels and a shaped waist. The front model photograph shows the coat worn over a short dark dress with knee-high boots. The rear product view reveals long vertical panels, a horizontal waist seam and a gently flared hem. Compare both views for the tailored outline.' },
  { colour: 'Brown', hex: '#654332', views: [[3, 'model-back']], description: 'A brown longline leather coat shown from the rear on a model. Shaped back seams meet a horizontal waist seam above a gently flared lower section, with a fold-down collar at the neckline. Only the rear model view is available; front fastening and pocket details are unconfirmed.' },
  { colour: 'Red', hex: '#b42b29', views: [[4, 'back']], description: 'Red leather gives this longline coat a bold finish. The rear product photograph shows a fold-down collar, shaped vertical back panels and a defined waist seam above the flared hem. Only a back view is available for this colourway; front fastening and pocket details are unconfirmed.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-longline-slim-leather-coat`;
  const name = `Women's ${design.colour} Longline Slim Leather Coat`;
  assert(!preserved.some(product => product.slug === slug), 'Slug collision');
  const gallery = [];
  for (const [id, view] of design.views) {
    assert(![5, 6, 7].includes(id), 'Promotional images excluded');
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.png$/i.test(source), 'Images only, never videos');
    const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
  }
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Shaped waist · Longline silhouette`, category: 'leather-jackets', priceGBP: 249,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: design.description,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Longline coat with shaped back panels and a defined waist seam' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-leather-coats'], itemGroupId: 'TX-WLSC-01',
    seoTitle: `Women's ${design.colour} Longline Slim Leather Coat | Tuxar`, seoDescription: `Explore the women's ${design.colour.toLowerCase()} longline leather coat at Tuxar. Shaped seams and a defined waist, with available photographs. Sizing awaiting confirmation.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 4);
catalogue.products = [...preserved, ...additions];
// Proposed draft price within the existing local coat edit; costs and margin remain unconfirmed.
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-long-slim-coats-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ products: additions.length, images: imageMap.length, excludedPromotionalImages: 3, videosImported: 0, localOnly: true, networkWrites: 0 }));
