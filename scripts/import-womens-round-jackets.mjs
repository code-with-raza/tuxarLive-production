import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-round-jackets-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-round-jackets/inventory.json', 'utf8'));
const designs = [
  { colour: 'Black', hex: '#171717', views: [[1, 'back']], description: 'A black collarless leather jacket shown from the rear. The rounded neckline sits above a horizontal shoulder yoke and long shaped back panels, while metal zips finish the sleeve cuffs. Only the back photograph is available; front fastening and pocket details are not confirmed for this colourway.' },
  { colour: 'Brown', hex: '#654332', views: [[2, 'front']], description: 'Brown leather tones frame a round, collarless neckline and central silver-tone zip. Angled shoulder seams and vertical body panels shape the waist, with slim zipped pockets set into the front. The available product photograph shows the front of this colourway.' },
  { colour: 'Burgundy', hex: '#682c35', views: [[3, 'front']], description: 'A burgundy round-neck leather jacket with a clean collarless edge and central silver-tone zip. Shaped seams run through the front above a gently curved lower edge, with narrow zipped waist pockets completing the design. The front product view shows the deep wine colour and panel layout.' },
  { colour: 'Red', hex: '#b42b29', views: [[4, 'model-front'], [5, 'model-back']], description: 'Red leather brings colour to this round-neck zip jacket, shown on a model with black trousers. The front view shows the collarless neckline and fitted body, while the back view shows the shoulder yoke, long shaped panels and gently curved hem. Compare both model views for its silhouette.' },
  { colour: 'Tan', hex: '#b77c43', views: [[7, 'three-quarter'], [6, 'model-back']], description: 'A tan collarless leather jacket with a round neckline, silver-tone front zip and angled zipped waist pockets. The three-quarter product photograph shows the curved shoulder seams and fitted waist. A rear model view shows the panelled back and short, gently curved lower edge.' },
];
const additions = [], imageMap = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-round-neck-leather-jacket`;
  const name = `Women's ${design.colour} Round-Neck Leather Jacket`;
  assert(!preserved.some(product => product.slug === slug), 'Slug collision');
  const gallery = [];
  for (const [id, view] of design.views) {
    assert.notEqual(id, 8, 'Exclude the promotional badge image');
    const source = inventory.find(image => image.id === id)?.source;
    assert(source && /\.png$/i.test(source));
    const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
    const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
    await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    gallery.push(`/${destination}`);
    imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
  }
  additions.push({ batchId, slug, name, audience: 'women', tagline: `${design.colour} · Round neckline · Shaped panels`, category: 'leather-jackets', priceGBP: 179,
    currency: 'GBP', image: gallery[0], gallery, colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; composition awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: design.description,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Design', value: 'Round collarless neckline and shaped body panels' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['women-aviator-jackets'], itemGroupId: 'TX-WRJ-01',
    seoTitle: `Women's ${design.colour} Round-Neck Leather Jacket | Tuxar`, seoDescription: `Explore the women's ${design.colour.toLowerCase()} round-neck leather jacket at Tuxar. Collarless styling and shaped seams, with available photographs. Sizing awaiting confirmation.`, cataloguePreview: true });
}
assert.equal(imageMap.length, 7);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/style/su447421/ae6628';
if (!catalogue.pricingSources.some(source => source.url === url)) catalogue.pricingSources.push({ url, observed: 'Lipsy collarless leather jacket listed at £118 sale, £169 previous price when researched. Different product; qualitative UK reference only. Tuxar round-neck draft proposed at £179, not a market average or discount claim.', checked: '2026-10-25' });
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-round-jackets-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: additions.length, newImages: imageMap.length, excludedPromotionalImages: 1, localOnly: true, networkWrites: 0 }));
