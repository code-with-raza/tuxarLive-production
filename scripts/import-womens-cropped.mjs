import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const batchId = 'womens-cropped-01';
const families = [
  { key: 'belt', price: 189, excluded: [1, 2, 11], items: [
    ['Black', '#171717', 'cape-shoulder-belted', 'Cape-Shoulder Belted', [[9, 'front']], 'A black cropped leather jacket with cape-style shoulder panels and a pointed front hem. A matching buckle belt draws in the waist, while the broad collar and off-centre fastening give the front a distinctive shape. Wear it over a simple top with high-waisted trousers to keep the belt and layered shoulders in view.'],
    ['Red', '#a72a29', 'pointed-hem-belted', 'Pointed-Hem Belted', [[4, 'front'], [5, 'back'], [3, 'model-front']], 'Red leather, a pointed front hem and a matching buckle belt make this cropped jacket a statement layer. The broad collar sits above cape-style shoulder panels, with long sleeves balancing the short body. The back has a curved hem and a central seam. Pair it with black denim or tailored trousers.'],
    ['Brown', '#654332', 'layered-shoulder-belted', 'Layered-Shoulder Belted', [[7, 'front'], [8, 'back'], [6, 'model-front']], 'This brown cropped leather jacket combines layered shoulders with a wide collar and a waist-defining buckle belt. Its pointed front contrasts with the rounded back hem, creating a different outline from each angle. Wear it with cream trousers for contrast, or keep the look tonal with darker brown layers.'],
    ['Burgundy', '#642c35', 'curved-hem-belted', 'Curved-Hem Belted', [[10, 'back']], 'A burgundy cropped leather jacket with a defined waist and a curved back hem. The rear view shows a raised collar, cape-style shoulder panels and a central back seam, with the matching belt running across the waist. Its wine tone works with charcoal, black and neutral separates. The available photograph shows the back of this colourway.'],
  ] },
  { key: 'zip', price: 169, excluded: [10, 11], items: [
    ['Black', '#171717', 'panelled-cropped-zip', 'Panelled Cropped Zip', [[3, 'front'], [1, 'model-front'], [2, 'model-back']], 'A short black leather jacket with a shirt-style collar and a straight front zip. Vertical panel seams shape the body without a belt, while long sleeves keep the silhouette clean. The model views show how the cropped hem sits with high-rise jeans. An understated choice for layering over a vest or a fitted top.'],
    ['Brown', '#624032', 'shirt-collar-cropped', 'Shirt-Collar Cropped', [[5, 'three-quarter'], [4, 'model-front']], 'Brown leather gives this cropped zip jacket a softer alternative to black. A pointed shirt collar frames the neckline, with vertical front seams and a straight hem keeping the shape simple. Style it open over a plain top or zip it up with high-waisted jeans. The photographs include a three-quarter product view and a full-length model view.'],
    ['Burgundy', '#682e3a', 'contour-seam-cropped', 'Contour-Seam Cropped', [[6, 'front'], [7, 'three-quarter']], 'A burgundy leather jacket cut short through the body, with a pointed collar and a central metal zip. Long panel seams add definition through the front, and the plain hem keeps the focus on the wine-red colour. Pair it with charcoal trousers or dark denim for an easy contrast.'],
    ['Red', '#b42b29', 'short-cut-zip', 'Short-Cut Zip', [[8, 'model-front'], [9, 'back']], 'A red cropped leather jacket with long sleeves, a pointed collar and a zip-front design. The rear product view shows the shoulder yoke and vertical back panels; the model photograph shows the front styled with black trousers. The short, straight hem pairs with high-rise bottoms without covering the waistline.'],
  ] },
];
const target = 'src/data/products/local-womens-jackets.json';
let existing = { products: [] };
try { existing = JSON.parse(await fs.readFile(target, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const preserved = existing.products.filter(product => product.batchId !== batchId);
const products = [], images = [];
const directory = 'src/assets/products/local-jacket-import';
await fs.mkdir(directory, { recursive: true });
for (const family of families) {
  const inventory = JSON.parse(await fs.readFile(`output/womens-cropped-${family.key}/inventory.json`, 'utf8'));
  for (const [colour, hex, design, title, views, description] of family.items) {
    const slug = `womens-${colour.toLowerCase()}-${design}-leather-jacket`;
    const name = `Women's ${colour} ${title} Leather Jacket`;
    assert(!preserved.some(product => product.slug === slug), 'Slug collision');
    const gallery = [];
    for (const [id, view] of views) {
      const source = inventory.find(image => image.id === id)?.source;
      assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
      assert(!family.excluded.includes(id), 'Excluded promotional image');
      const buffer = await fs.readFile(source);
      const hash = createHash('sha256').update(buffer).digest('hex');
      const destination = `${directory}/${slug}-${view}.webp`;
      await sharp(buffer).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
      assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
      gallery.push(`/${destination}`);
      images.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
    }
    products.push({ batchId, slug, name, tagline: `Cropped silhouette · ${colour} · Women's leather`, category: 'leather-jackets',
      priceGBP: family.price, currency: 'GBP', image: gallery[0], gallery, colors: [{ name: colour, hex }], sizes: [], material: 'Leather', weight: '', rating: 0, reviewCount: 0,
      description, specs: [{ label: 'Colour', value: colour }, { label: 'Style', value: family.key === 'belt' ? 'Cropped, belted, cape-style shoulders' : 'Cropped, shirt collar, zip front' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
      inStock: false, collections: ['cropped-jackets'], itemGroupId: `TX-WC-${family.key.toUpperCase()}`,
      seoTitle: `Women's ${colour} ${family.key === 'belt' ? 'Belted Cropped' : 'Cropped Zip'} Leather Jacket | Tuxar`,
      seoDescription: `Explore Tuxar's women's ${colour.toLowerCase()} cropped leather jacket with ${family.key === 'belt' ? 'a matching waist belt and layered shoulders' : 'a shirt-style collar and zip front'}. View the design and styling photographs.`, cataloguePreview: true });
  }
}
assert.equal(new Set(products.map(product => product.slug)).size, products.length);
await fs.writeFile(target, JSON.stringify({ schemaVersion: 1, localOnly: true, publishReady: false, currency: 'GBP',
  pricingNote: 'Proposed local prices only; confirm costs and margin. No market-average or previous-price claim.',
  pricingSources: [
    { url: 'https://www.allsaints.com/women/leather/leather-jackets/cropped', checked: '2026-10-25', observed: 'Cropped leather styles listed at £399–£499' },
    { url: 'https://www.next.co.uk/style/su587216/ar2982', checked: '2026-10-25', observed: 'Urban Code cropped leather trench £55 sale; £149 previous price shown by retailer' },
  ], products: [...preserved, ...products] }, null, 2) + '\n');
await fs.writeFile('output/womens-cropped-image-map.json', JSON.stringify(images, null, 2) + '\n');
console.log(JSON.stringify({ products: products.length, images: images.length, videosImported: 0, localOnly: true, sizesAndStock: 'Unconfirmed; no stock invented', networkWrites: 0 }));
