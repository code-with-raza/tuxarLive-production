import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-leather-coats-01';
const products = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-leather-coats/inventory.json', 'utf8'));
const hooded = products.filter(product => product.batchId === 'womens-fur-01' && product.itemGroupId === 'TX-WF-3');
assert.equal(hooded.length, 3, 'Existing hooded coats must be imported first');
for (const product of hooded) product.collections = [...new Set([...product.collections, 'women-leather-coats'])];
const designs = [
  { colour: 'Black', hex: '#171717', price: 239, key: 'cream-lapel', title: "Women's Black Cream-Lapel Leather Coat", views: [[2, 'front'], [3, 'back']],
    description: 'A black leather coat edged with contrasting cream fur-style trim. Wide lapels lead into the open-looking front, with cream detailing outlining the waist pockets and turned-back cuffs. The rear photograph shows a horizontal shoulder yoke and long vertical panels. Pair the hip-covering silhouette with straight-leg jeans or tailored trousers. Fur type and composition are awaiting supplier confirmation.' },
  { colour: 'Tan', hex: '#b78350', price: 229, key: 'cream-trim', title: "Women's Tan Cream-Trim Leather Coat", views: [[1, 'model-back']],
    description: 'A tan leather coat shown from the back on a model, with cream fur-style trim at the collar and cuffs. The panelled back has a horizontal shoulder yoke and a straight, hip-covering hem. Blue denim creates a relaxed contrast with the warm tan shade. Only a rear model photograph is available for this colourway; front fastening and pocket details are not confirmed. Fur type and composition are awaiting supplier confirmation.' },
];
const imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-${design.key}-leather-coat`;
  assert(!products.some(product => product.slug === slug), 'Slug collision');
  const gallery = [];
  for (const [id, view] of design.views) {
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
    const bytes = await fs.readFile(source);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${design.title} — ${view.replaceAll('-', ' ')}` });
  }
  products.push({ batchId, slug, name: design.title, tagline: `${design.colour} · Cream trim · Hip-covering silhouette`, category: 'leather-jackets', priceGBP: design.price,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; fur trim composition unconfirmed', weight: '', rating: 0, reviewCount: 0,
    description: design.description, specs: [{ label: 'Colour', value: design.colour }, { label: 'Trim', value: 'Cream fur-style texture; real or faux composition not verified' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-leather-coats'], itemGroupId: 'TX-WC-COAT-01',
    seoTitle: `${design.title} | Tuxar`, seoDescription: `Explore Tuxar's women's ${design.colour.toLowerCase()} leather coat with cream fur-style collar and cuff trim. Browse available product photographs and design details.`, cataloguePreview: true });
}
catalogue.products = products;
const url = 'https://www.next.co.uk/shop/womens/clothing/coats-and-jackets/coats/f/material-leather';
catalogue.pricingSources = [...catalogue.pricingSources.filter(source => source.url !== url), { url, checked: '2026-10-25', observed: 'Lakeland Leather Arndale hooded coats £349; Jigsaw leather knee-length coat £499. Qualitative comparison only; proposed Tuxar prices require cost/margin confirmation.' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-coats-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: designs.length, newImages: imageMap.length, existingHoodedProductsAssigned: hooded.length, collectionProducts: products.filter(product => product.collections.includes('women-leather-coats')).length, videosImported: 0, networkWrites: 0 }));
