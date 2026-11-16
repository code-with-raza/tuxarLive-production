import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-lapel-fur-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const inventory = JSON.parse(await fs.readFile('output/womens-lapel-fur/inventory.json', 'utf8'));
const designs = [
  { colour: 'Black', hex: '#171717', key: 'fur-collar-panelled', title: "Women's Black Fur-Collar Panelled Leather Coat", id: 1, view: 'model-back',
    description: 'A black leather coat with a broad black fur-style collar and matching cuff trims, shown from the back on a model. A horizontal shoulder yoke and shaped vertical seams define the hip-covering body. Style it with dark trousers for a tonal look. Only a rear photograph is available for this colourway; front fastening and pocket details are not confirmed.' },
  { colour: 'Brown', hex: '#634332', key: 'double-breasted-fur-lapel', title: "Women's Brown Double-Breasted Fur-Lapel Leather Coat", id: 2, view: 'front',
    description: 'Brown leather tones frame wide black fur-style lapels on this double-breasted coat. Two rows of dark buttons, matching plush cuffs and slanted waist pockets give the front a defined outline. The hip-covering length works over slim trousers or straight-leg denim, keeping the contrasting lapels in view.' },
  { colour: 'Tan', hex: '#b88750', key: 'black-trim-panel-back', title: "Women's Tan Black-Trim Panel-Back Leather Coat", id: 3, view: 'back',
    description: 'A tan leather coat with contrasting black fur-style collar and cuff trims. The rear product photograph shows long shaped panels, a horizontal seam across the lower back and a slightly curved hem. The warm body colour brings out the dark trim. Front fastening and pocket details are not confirmed from the available rear view.' },
];
const imageMap = [], additions = [];
for (const design of designs) {
  const slug = `womens-${design.colour.toLowerCase()}-${design.key}-leather-coat`;
  assert(!preserved.some(product => product.slug === slug), 'Slug collision');
  assert.notEqual(design.id, 4, 'Duty-free badge image excluded');
  const source = inventory.find(image => image.id === design.id)?.source;
  assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
  const bytes = await fs.readFile(source);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const destination = `src/assets/products/local-jacket-import/${slug}-${design.view}.webp`;
  await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
  assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
  const image = `/${destination}`;
  imageMap.push({ source, sha256: hash, path: image, alt: `${design.title} — ${design.view.replaceAll('-', ' ')}` });
  additions.push({ batchId, slug, name: design.title, tagline: `${design.colour} · Black fur-style trim · Hip-covering silhouette`, category: 'leather-jackets', priceGBP: 249,
    currency: 'GBP', image, gallery: [image], colors: [{ name: design.colour, hex: design.hex }], sizes: [], material: 'Leather; fur trim composition unconfirmed', weight: '', rating: 0, reviewCount: 0,
    description: `${design.description} Fur type and composition are awaiting supplier confirmation.`,
    specs: [{ label: 'Colour', value: design.colour }, { label: 'Trim', value: 'Black fur-style collar and cuffs; real or faux composition not verified' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
    inStock: false, collections: ['leather-fur-jackets'], itemGroupId: 'TX-WF-LAPEL-01',
    seoTitle: `Women's ${design.colour} Fur-Lapel Leather Coat | Tuxar`, seoDescription: `Explore Tuxar's women's ${design.colour.toLowerCase()} leather coat with black fur-style collar and cuff trims. Browse the available photograph and design details.`, cataloguePreview: true });
}
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/style/sv069080/g24201';
catalogue.pricingSources = [...catalogue.pricingSources.filter(source => source.url !== url), { url, checked: '2026-10-25', observed: 'Lakeland Leather women’s Borrowdale collared leather jacket £279. Qualitative leather outerwear comparison, not identical fur-trim product; proposed £249 local price requires cost/margin confirmation.' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-lapel-fur-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: additions.length, images: imageMap.length, excludedBadgeImages: 1, videosImported: 0, localOnly: true, networkWrites: 0 }));
