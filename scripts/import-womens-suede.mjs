import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-suede-01';
const displaced = catalogue.products.filter(product => product.batchId !== batchId && product.collections?.includes('women-suede-jackets'));
const preserved = catalogue.products.filter(product => product.batchId !== batchId).map(product =>
  product.collections?.includes('women-suede-jackets')
    ? { ...product, collections: product.collections.filter(collection => collection !== 'women-suede-jackets') }
    : product);
const inventory = JSON.parse(await fs.readFile('output/womens-suede/inventory.json', 'utf8'));
const designs = [
  { colour: 'Tan', hex: '#ad6b35', views: [[2, 'front'], [1, 'model-front']], description: 'A tan suede leather jacket with a short stand collar and central zip. Quilted panels add texture across the shoulders and upper sleeves, while curved seams shape the waist. The model photograph shows it styled with cream trousers, bringing out the warm tan tone.' },
  { colour: 'Black', hex: '#171717', views: [[5, 'three-quarter'], [3, 'model-front'], [4, 'model-back']], description: 'Black suede gives this zip-front jacket a softly textured finish. Quilted upper sleeves frame the fitted body, with a short stand collar and shaped side seams keeping the outline neat. Front and back model photographs show how the waist-length hem sits with light trousers.' },
  { colour: 'Grey', hex: '#777477', views: [[6, 'model-front']], description: 'A grey suede leather jacket photographed on a model with cream trousers. The front shows a short stand collar, central zip and shaped waist, with quilted detailing at the shoulders. The muted colour makes a lighter alternative to black. Only the front model photograph is available for this colourway.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-quilt-shoulder-suede-leather-jacket`;
  const name = `Women's ${design.colour} Quilt-Shoulder Suede Jacket`;
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
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Suede leather · Quilted shoulders`, category: 'leather-jackets', priceGBP: 199,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Suede leather; hide type unconfirmed', weight: '', rating: 0, reviewCount: 0,
    description: design.description, specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Quilted shoulders, stand collar and central zip' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-suede-jackets'], itemGroupId: 'TX-WS-01',
    seoTitle: `${name} | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase()} suede leather jacket with quilted shoulders, a stand collar and zip front. View the available photographs and design details at Tuxar.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 6);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/shop/womens/clothing/coats-and-jackets/jackets/f/material-suede';
catalogue.pricingSources = [...catalogue.pricingSources.filter(source => source.url !== url), { url, checked: '2026-10-25', observed: 'Women’s suede examples: Urban Code £149, BHOEM £179–£199, Friends Like These £195. Proposed Tuxar £199 local price is qualitative and requires cost/margin confirmation.' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-suede-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ productsInReplacedCategory: additions.length, images: imageMap.length, otherProductsUnassigned: displaced.length, videosImported: 0, localOnly: true, networkWrites: 0 }));
