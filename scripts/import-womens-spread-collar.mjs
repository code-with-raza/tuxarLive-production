import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
assert.equal(catalogue.localOnly, true);
const batchId = 'womens-spread-collar-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-spread-collar/inventory.json', 'utf8'));
const designs = [
  { colour: 'Brown', hex: '#8b512e', views: [[2, 'front'], [1, 'model-front']], description: 'A brown leather jacket with a broad spread collar and wide lapels framing an angled silver-tone zip. Shaped front panels follow the waist above a short hem. The product and model-front photographs show the collar open, styled over a dark top and trousers.' },
  { colour: 'Red', hex: '#b42b29', views: [[3, 'front']], description: 'Red leather and silver-tone hardware define this spread-collar jacket. Wide lapels sit above an angled front zip, with curved seams shaping the waist and long sleeves finishing the short silhouette. The available photograph shows the front of this colourway.' },
  { colour: 'Black', hex: '#171717', views: [[4, 'front']], description: 'A black leather jacket with a wide spread collar, pointed lapels and angled front zip. Panel seams shape the waist and continue towards the hem for a fitted outline. The front product photograph shows the open lapels and silver-tone fastening against the black finish.' },
  { colour: 'Pink', hex: '#d47596', views: [[5, 'front']], description: 'Pink leather brings a brighter tone to this spread-collar zip jacket. Wide pointed lapels frame the neckline, with an angled silver-tone zip and shaped body seams defining the front. Only the front product view is available for this colourway.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-spread-collar-leather-jacket`;
  const name = `Women's ${design.colour} Spread-Collar Leather Jacket`;
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
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Spread collar · Angled zip`, category: 'leather-jackets', priceGBP: 199,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: `${design.description} Fashion outerwear; not verified motorcycle protective clothing.`,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Spread collar, wide lapels and angled front zip' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-racing-jackets'], itemGroupId: 'TX-WSC-01',
    seoTitle: `Women's ${design.colour} Spread-Collar Leather Jacket | Tuxar`, seoDescription: `Women's ${design.colour.toLowerCase()} leather jacket with wide lapels, angled zip and shaped seams. View available photographs at Tuxar. Sizing awaiting confirmation.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 5);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/shop/womens/clothing/coats-and-jackets/jackets/f/brand-sosandar-style-biker';
if (!catalogue.pricingSources.some(source => source.url === url)) catalogue.pricingSources.push({ url, checked: '2026-10-25', observed: 'Sosandar leather biker jackets listed at £275; faux-leather styles at £79 are not leather comparators. Qualitative UK retail reference only. Tuxar spread-collar local draft proposed at £199, not a market average or discount claim. Confirm supplier composition, costs and margin.' });
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-spread-collar-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ products: additions.length, images: imageMap.length, videosImported: 0, localOnly: true, networkWrites: 0 }));
