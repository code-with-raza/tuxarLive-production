import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-riding-coats-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const safety = 'Motorcycle-inspired fashion outerwear. Protective equipment and CE/UKCA certification are unverified; do not rely on this garment as motorcycle protective clothing.';
const families = [
  { id: 0, key: 'quilt-panel-biker', title: 'Quilt-Panel Leather Biker Jacket', shortTitle: 'Leather Biker Jacket', collection: 'women-biker-jackets', price: 209, excluded: [], material: 'Leather', detail: 'a tab collar, quilted panels and zip detailing', items: [
    ['Black', '#171717', [[9, 'model-front'], [1, 'back']], 'Black leather and quilted shoulder panels give this fitted biker-style jacket a defined outline. The model-front and rear product views show a short tab collar, long sleeves and a shaped waist.'],
    ['Brown', '#654332', [[10, 'front'], [2, 'model-front']], 'A brown zip-front biker-style jacket with a tab collar and textured shoulder detailing. The central zip is framed by vertical seams, with zipped waist pockets visible in the product photograph.'],
    ['Red', '#b42b29', [[8, 'front'], [5, 'three-quarter'], [3, 'model-front'], [4, 'model-back'], [7, 'model-rear-angle']], 'Red leather brings colour to this fitted zip jacket, with quilted details and a short tab collar. Product and model views show the waist shaping and long sleeves from several angles.'],
    ['Burgundy', '#682c35', [[6, 'front']], 'A burgundy leather biker-style jacket with a stand collar and central zip. Quilted side panels frame the fitted body above zipped waist pockets. The available product photograph shows the front.'],
  ] },
  { id: 1, key: 'gothic-pointed-tail', title: 'Gothic Hooded Leather Tail Coat', shortTitle: 'Gothic Leather Tail Coat', collection: 'women-leather-coats', price: 279, excluded: [7, 8], material: 'Leather', detail: 'a hood, lapels, buckle details and pointed tails', items: [
    ['Red', '#b42b29', [[1, 'front'], [2, 'back'], [3, 'three-quarter']], 'A red hooded leather tail coat with wide lapels and paired buckle details through the waist. The fitted upper body falls into long pointed tails, shown clearly in the front, back and three-quarter photographs.'],
    ['Burgundy', '#682c35', [[4, 'front'], [5, 'three-quarter']], 'Burgundy leather tones give this gothic tail coat a deep wine finish. A large hood, lapels and paired waist buckles sit above the angular split hem. Both photographs show the front outline.'],
    ['Brown', '#654332', [[6, 'three-quarter']], 'A brown hooded leather tail coat with a shaped waist and pointed lower panels. The three-quarter view shows its broad lapels, decorative buckle rows and longer rear tails. Style it over simple dark layers.'],
  ] },
  { id: 2, key: 'hooded-belted-frock', title: 'Hooded Belted Leather Frock Coat', shortTitle: 'Hooded Leather Frock Coat', collection: 'women-leather-coats', price: 259, excluded: [], material: 'Leather', detail: 'a hood, double-breasted styling and a waist belt', items: [
    ['Black', '#171717', [[1, 'front'], [2, 'back']], 'A black leather frock coat with a hood, double-breasted front and matching buckle belt. The skirted lower body flares below the waist. Front and back photographs show its panelled construction and hip-covering length.'],
    ['Brown', '#654332', [[3, 'model-back']], 'A brown leather frock coat shown from the back on a model. The hood rests over the shoulders above a matching waist belt, with gathering below the waist creating a flared lower shape. Front details are not confirmed.'],
    ['Burgundy', '#682c35', [[4, 'three-quarter']], 'Burgundy leather tones frame dark double-breasted buttons on this hooded frock coat. A matching buckle belt defines the waist, while the lower body opens into a short flared skirt. The photograph shows a three-quarter front view.'],
    ['Tan', '#b78350', [[5, 'model-back']], 'A tan hooded leather frock coat shown from the rear with light trousers. Its matching waist belt draws in the body above a flared hem. Only the rear model photograph is available; front button and pocket details are not confirmed.'],
  ] },
  { id: 3, key: 'contrast-panel-motorcycle', title: 'Contrast-Panel Motorcycle-Style Leather Jacket', shortTitle: 'Contrast Moto-Style Jacket', collection: 'women-motorcycle-jackets', price: 219, excluded: [9, 10], material: 'Leather with contrast panels; textile composition unconfirmed', detail: 'contrast panels, sleeve stripes and zip detailing', items: [
    ['Red / Black', '#b42b29', [[1, 'back']], 'A red and black motorcycle-style jacket shown from the rear. Black side and shoulder panels follow the shaped body, with light sleeve bands and a central back zip detail. Front details are not confirmed for this colourway.'],
    ['Yellow / Black', '#dfad14', [[4, 'three-quarter'], [3, 'back'], [2, 'model-front']], 'Yellow panels contrast with black sides and sleeves on this fitted motorcycle-inspired jacket. Product views show the stand collar, angled waist zips, light sleeve bands and central rear zip detail. A model photograph shows the front proportions.'],
    ['Orange / Black', '#e26c12', [[5, 'back']], 'Orange and black panels give this motorcycle-style jacket a strong rear outline. The product photograph shows black shoulder and side sections, light sleeve bands and a vertical back zip detail. Only the rear view is available.'],
    ['Brown / Black', '#795038', [[6, 'model-back']], 'A brown and black motorcycle-inspired jacket photographed from the back on a model. Contrast side panels and light sleeve bands frame the waist, with a central rear zip detail. The front design is not confirmed from this photograph.'],
    ['White / Black', '#eeeeea', [[8, 'front'], [7, 'back']], 'White panels and black sides define this motorcycle-style zip jacket. The front shows a stand collar and angled waist zips, while the rear has a long central zip detail and contrasting sleeve bands. Compare both views for the panel layout.'],
  ] },
  { id: 4, key: 'twin-stripe-motorcycle', title: 'Twin-Stripe Motorcycle-Style Leather Jacket', shortTitle: 'Twin-Stripe Moto-Style Jacket', collection: 'women-motorcycle-jackets', price: 229, excluded: [], material: 'Leather', detail: 'twin sleeve stripes, a tab collar and zipped pockets', items: [
    ['Black', '#171717', [[1, 'model-front'], [2, 'model-back']], 'A black leather motorcycle-style jacket with light twin stripes on the upper sleeves and across the back. Model photographs show the front zip, short collar and fitted shape, styled with dark trousers.'],
    ['Brown', '#654332', [[3, 'model-front']], 'Brown leather tones and light sleeve stripes give this motorcycle-inspired jacket a warm contrast. The front model photograph shows a raised collar, central zip and zipped chest details. Pair the fitted silhouette with dark denim.'],
    ['Red', '#b42b29', [[5, 'front'], [6, 'back'], [7, 'three-quarter'], [4, 'model-front']], 'A red leather motorcycle-style jacket with twin light stripes on the upper sleeves and across the back. Zipped chest and waist pockets, zip cuffs and a tab collar add detail. Product views show the front and rear panel layout.'],
  ] },
];
const additions = [], imageMap = [];
for (const family of families) {
  const inventory = JSON.parse(await fs.readFile(`output/womens-riding-coats-${family.id}/inventory.json`, 'utf8'));
  for (const [colour, hex, views, copy] of family.items) {
    const colourKey = colour.toLowerCase().replaceAll(' / ', '-');
    const slug = `womens-${colourKey}-${family.key}-leather-${family.collection === 'women-leather-coats' ? 'coat' : 'jacket'}`;
    const name = `Women's ${colour} ${family.title}`;
    assert(!preserved.some(product => product.slug === slug), 'Slug collision');
    const gallery = [];
    for (const [id, view] of views) {
      assert(!family.excluded.includes(id), 'Promotional image excluded');
      const source = inventory.find(image => image.id === id)?.source;
      assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
      const bytes = await fs.readFile(source), hash = createHash('sha256').update(bytes).digest('hex');
      const destination = `src/assets/products/local-jacket-import/${slug}-${view}.webp`;
      await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
      assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
      gallery.push(`/${destination}`);
      imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
    }
    const ridingStyle = family.collection !== 'women-leather-coats';
    additions.push({ batchId, slug, name, audience: 'women', tagline: `${colour} · ${family.title}`, category: 'leather-jackets', priceGBP: family.price,
      currency: 'GBP', image: gallery[0], gallery, colors: [{ name: colour, hex }], sizes: [], material: family.material, weight: '', rating: 0, reviewCount: 0,
      description: ridingStyle ? `${copy} ${safety}` : copy,
      specs: [{ label: 'Colour', value: colour }, { label: 'Design', value: family.detail }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }, ...(ridingStyle ? [{ label: 'Safety', value: safety }] : [])],
      inStock: false, collections: [family.collection], itemGroupId: `TX-WRC-${family.id + 1}`,
      seoTitle: `Women's ${colour} ${family.shortTitle} | Tuxar`,
      seoDescription: `Women's ${colour.toLowerCase()} leather ${ridingStyle ? 'jacket' : 'coat'} with ${family.detail}. View the available photographs and design details at Tuxar.`, cataloguePreview: true });
  }
}
assert.equal(additions.length, 19);
assert.equal(imageMap.length, 36);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/shop/womens/clothing/coats-and-jackets/f/material-leather-style-biker';
catalogue.pricingSources = [...catalogue.pricingSources.filter(source => source.url !== url), { url, checked: '2026-10-25', observed: 'Women’s leather biker examples: Next £195, FatFace £199, Lakeland Tarraby £249. Fashion comparisons only; no verified protective equivalence. Proposed Tuxar prices £209–£279 require cost/margin confirmation.' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-riding-coats-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ products: additions.length, images: imageMap.length, biker: 4, coats: 7, motorcycleStyle: 8, videosImported: 0, localOnly: true, networkWrites: 0 }));
