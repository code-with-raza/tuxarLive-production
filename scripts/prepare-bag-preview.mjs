import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Export the already edited masters for the local catalogue; originals stay untouched.
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(process.argv[2] ?? 'D:/Codex/product images-20261024T235301Z-1-001/bags');
const previousCatalogue = JSON.parse(await fs.readFile('src/data/products/local-bags.json', 'utf8').catch(() => '{}'));
if (previousCatalogue.pricesApproved) throw Error('These bags are approved. Preserve the approved catalogue; use the production preparation workflow for further changes.');
const drafts = JSON.parse(await fs.readFile(path.join(root, 'catalogue-drafts.json'), 'utf8'));
const prices = [109, 189, 119, 149, 129, 189, 139, 159, 219, 139, 129];
const details = [
  'A rounded brown backpack with a top carry loop and front zipped pocket.',
  'A rectangular brown travel bag with top handles, a shoulder strap, a front buckle-fastened pocket and two vertical zipped pockets.',
  'A black rounded backpack with a front zipped pocket and a visible OVERTOP logo patch.',
  'A brown rucksack with a buckled top flap, drawstring closure and a double-buckle front pocket.',
  'A rounded brown backpack with contrast edging, a front zipped pocket and a small circular badge.',
  'A dark brown barrel-shaped duffel with a distressed finish, top handles, a shoulder strap and an exterior zipped pocket.',
  'A structured tan backpack with a top handle, broad flap, front slip pocket and metal-ring tab.',
  'A black and brown two-tone rucksack with a flap, twin buckle straps and side pockets.',
  'A brown and white spotted holdall with tan trim, top handles, a shoulder strap and a zipped end pocket.',
  'A tan distressed-finish backpack with an upper zipped pocket and a larger lower zipped compartment.',
  'A black backpack with a centre seam, front zipped compartment, side pockets and top carry handle.',
];
await fs.mkdir('src/assets/products/local-bag-import', { recursive: true });
let totalBytes = 0;
const products = [];
for (const [index, draft] of drafts.products.entries()) {
  const gallery = [];
  for (const image of draft.images) {
    const filename = path.basename(image.edited, '.png') + '.webp';
    const destination = 'src/assets/products/local-bag-import/' + filename;
    await sharp(path.join(root, image.edited)).resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).webp({ quality: 85, effort: 4 }).toFile(destination);
    totalBytes += (await fs.stat(destination)).size;
    gallery.push('/' + destination);
  }
  const colour = draft.slug.includes('black-brown') ? ['Black / Brown', '#34261e'] : draft.slug.includes('spotted') ? ['Brown / White', '#795031'] : draft.slug.startsWith('black') ? ['Black', '#171717'] : draft.slug.startsWith('tan') ? ['Tan', '#b4773c'] : ['Brown', '#67432e'];
  products.push({
    slug: draft.slug, name: draft.name, tagline: 'Bag collection · local preview',
    category: 'leather-bags', audience: 'both', priceGBP: prices[index], currency: 'GBP',
    image: gallery[0], gallery, colors: [{ name: colour[0], hex: colour[1] }], sizes: ['One Size'],
    material: 'Awaiting supplier confirmation', weight: '', rating: 0, reviewCount: 0,
    description: details[index] + ' See the supplied photographs for the visible design. Material composition, measurements and capacity are awaiting supplier confirmation.',
    specs: [{ label: 'Colour', value: colour[0] }, { label: 'Measurements and capacity', value: 'Awaiting supplier confirmation' }],
    inStock: false, collections: ['leather-bags', 'women-leather-bags'],
    itemGroupId: 'bag-' + draft.slug, seoTitle: draft.name + ' | Tuxar', seoDescription: details[index],
    cataloguePreview: true, previewStockPerSize: draft.stock, pricingStatus: 'proposed',
  });
}
await fs.writeFile('src/data/products/local-bags.json', JSON.stringify({
  schemaVersion: 1, localOnly: true, publishReady: false, pricesApproved: false,
  sourceFolder: root,
  pricingNote: 'Proposed retail prices inferred from comparable UK bags, not verified identical products. Supplier costs and material specifications remain unconfirmed.',
  pricingSources: ['https://scaramangashop.co.uk/collections/all-leather-bags', 'https://www.ashwoodleatheroutlet.co.uk/collections/bags', 'https://www.cactusleatherlondon.com/product-page/cowhide-luxury-weekender'],
  products,
}, null, 2) + '\n');
console.log(JSON.stringify({ products: products.length, photos: products.reduce((n, p) => n + p.gallery.length, 0), totalBytes }));
