import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const batchId = 'womens-basic-leather-01';
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const families = [
  { id: 0, key: 'tab-collar-gathered-hem', title: 'Tab-Collar Leather Jacket', price: 199, excluded: [1, 10, 11], material: 'Leather', detail: 'a tab collar, shaped seams and gathered hem', items: [
    ['Black', '#171717', [[4, 'front']], 'A black leather jacket with a short press-stud tab collar and a central metal zip. Angled zipped pockets sit below the shaped front seams, while the gathered hem gives the waist a neat finish. Keep the look simple with a plain top and indigo jeans.'],
    ['Red', '#b42b29', [[2, 'model-front'], [3, 'model-back']], 'Red leather brings colour to this tab-collar zip jacket. The front and rear model photographs show a shaped body, long sleeves and a gathered lower edge. Wear it over a light top to bring out the contrast with the zip and collar hardware.'],
    ['Burgundy', '#682c35', [[5, 'front'], [6, 'back']], 'A burgundy leather jacket with a press-stud collar tab and zipped waist pockets. Vertical front panels give way to a horizontal shoulder yoke at the back, above a gathered hem. The deep wine tone pairs with charcoal trousers or dark denim.'],
    ['Brown', '#654332', [[7, 'model-front']], 'This brown leather jacket is shown worn over a light top with blue jeans. A central zip and short tab collar frame the neckline, with shaped panels and a gathered hem defining the waist. The photograph shows the front of this colourway.'],
    ['Pink', '#d891a2', [[8, 'model-front'], [9, 'back']], 'Pink leather gives this short zip jacket a brighter finish. The model-front view shows the stand collar and shaped body, while the rear product photograph shows the shoulder yoke, vertical panels and gathered hem. Pair it with dark trousers for contrast.'],
  ] },
  { id: 1, key: 'gathered-waist-peplum', title: 'Gathered-Waist Leather Peplum Jacket', price: 189, excluded: [], material: 'Leather', detail: 'a collarless neckline, patch chest pockets and gathered waist', items: [
    ['Tan', '#b77c43', [[2, 'front'], [1, 'model-back']], 'A tan collarless leather jacket with gold-tone front fastenings and two patch chest pockets. Gathering at the waist creates a small peplum flare below the fitted body. The rear model photograph shows the same gathered waist above the short flared hem.'],
    ['Red', '#ac2826', [[4, 'front'], [5, 'three-quarter'], [3, 'model-back']], 'Red leather and gold-tone hardware give this collarless peplum jacket a distinct front. Twin chest pockets sit above a gathered waist, with a short flare below the fastenings. The model-back view shows the curved waistline styled with light trousers.'],
    ['Brown', '#563629', [[6, 'three-quarter']], 'A brown leather peplum jacket with a round, collarless neckline and gold-tone hardware. The three-quarter photograph shows its patch chest pockets, long sleeves and elastic-looking waist gathering. The shaped lower edge sits over the hips without a separate belt.'],
    ['Black', '#171717', [[7, 'model-front'], [8, 'model-back']], 'A black collarless leather jacket shaped by gathering at the waist. Gold-tone fastenings and patch chest pockets add detail above a short peplum hem. The front and back model photographs show how the flared edge sits with black trousers.'],
  ] },
  { id: 2, key: 'rib-cuff-zip-bomber', title: 'Zip-Front Leather Bomber Jacket', price: 179, excluded: [], material: 'Leather; rib trim composition unconfirmed', detail: 'a ribbed collar, cuffs and gathered lower edge', items: [
    ['Burgundy', '#682c35', [[1, 'model-back']], 'A burgundy leather bomber shown from the back on a model. The photograph shows a relaxed body, ribbed collar, cuffs and gathered lower edge. Pair the short silhouette with high-rise jeans. Front pocket details are not confirmed from the available rear view.'],
    ['Black', '#171717', [[2, 'front']], 'A black leather bomber with a central zip and low ribbed collar. The plain front, gathered lower edge and ribbed cuffs keep the outline simple, while the fuller sleeves give it a relaxed shape. Wear it open over a vest or zipped over a light layer.'],
    ['Brown', '#654332', [[4, 'front'], [5, 'back'], [3, 'model-back']], 'Brown leather tones bring warmth to this zip-front bomber. A low ribbed collar and matching cuffs frame the relaxed body, with gathering at the hem. The back product photograph shows a horizontal shoulder seam above a clean panelled rear.'],
  ] },
  { id: 3, key: 'contour-panel-stand-collar', title: 'Contour-Panel Leather Zip Jacket', price: 209, excluded: [], material: 'Leather; contrast panel composition unconfirmed', detail: 'a stand collar, centre zip and curved body panels', items: [
    ['Black', '#171717', [[1, 'model-back']], 'A black leather jacket shown from the rear with a close-shaped waist and curved body panels. The short stand collar and long sleeves follow a clean fitted outline. The model photograph shows the rear only; front fastening and pocket details are not confirmed for this colourway.'],
    ['Brown', '#654332', [[2, 'model-front'], [3, 'back']], 'Brown leather tones follow curved seams through the body of this fitted zip jacket. The front model photograph shows a raised collar and central zip, while the rear product view shows shaped panels through the waist. Pair it with blue denim or straight black trousers.'],
    ['Red', '#b42b29', [[4, 'front'], [5, 'back']], 'A red leather zip jacket with a short stand collar and curved side panels. The shaped front and rear seams define the waist without a belt. The photographs show long sleeves and a clean, slightly curved lower edge. Contrast panel composition is awaiting supplier confirmation.'],
  ] },
  { id: 4, key: 'drawstring-waist-hooded', title: 'Drawstring-Waist Hooded Leather Jacket', price: 229, excluded: [7], material: 'Leather', detail: 'a hood, drawstring waist and longer hem', items: [
    ['Black', '#171717', [[1, 'back']], 'A black hooded leather jacket shown from the back, with a drawstring-gathered waist and a longer hem. The hood rests across the shoulders above a horizontal back yoke. Front fastening and pocket details are not confirmed from the available rear photograph.'],
    ['Burgundy', '#682c35', [[2, 'three-quarter']], 'A burgundy hooded leather jacket with an off-centre-looking front zip and adjustable drawstring waist. Vertical waist pockets and metal-tipped ties add detail through the front. The longer body flares below the gathering, making space for a light layer underneath.'],
    ['Brown', '#654332', [[5, 'front'], [3, 'model-front'], [4, 'model-back']], 'Brown leather tones and a shaped drawstring waist define this hooded jacket. The front has a zip fastening and vertical pockets, with a longer hem below the gathered waist. Front and back model photographs show the hood and hip-covering proportions.'],
    ['Tan', '#b78350', [[6, 'back']], 'A tan hooded leather jacket shown from the rear. Its drawstring waist gathers the body above a longer flared hem, with a panelled hood resting over the shoulders. The warm tan shade works with denim and neutral layers. Front details are not confirmed from the available photograph.'],
  ] },
];
const additions = [], imageMap = [];
for (const family of families) {
  const inventory = JSON.parse(await fs.readFile(`output/womens-basic-${family.id}/inventory.json`, 'utf8'));
  for (const [colour, hex, views, description] of family.items) {
    const slug = `womens-${colour.toLowerCase()}-${family.key}-leather-jacket`;
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
    additions.push({ batchId, slug, name, audience: 'women', tagline: `${colour} · Women's leather · ${family.key.replaceAll('-', ' ')}`, category: 'leather-jackets', priceGBP: family.price,
      currency: 'GBP', image: gallery[0], gallery, colors: [{ name: colour, hex }], sizes: [], material: family.material, weight: '', rating: 0, reviewCount: 0, description,
      specs: [{ label: 'Colour', value: colour }, { label: 'Design', value: family.detail }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
      inStock: false, collections: family.id === 1 ? ['women-leather-jackets', 'women-motorcycle-suits'] : family.id === 2 ? ['women-leather-jackets', 'women-shearling-jackets'] : family.id === 4 ? ['women-leather-jackets', 'women-varsity-jackets'] : ['women-leather-jackets'], itemGroupId: `TX-WL-${family.id + 1}`,
      seoTitle: `Women's ${colour} ${['Tab-Collar Jacket', 'Leather Peplum Jacket', 'Leather Bomber Jacket', 'Panelled Leather Jacket', 'Hooded Leather Jacket'][family.id]} | Tuxar`,
      seoDescription: `Women's ${colour.toLowerCase()} leather jacket with ${family.detail}. Browse available photographs and design details at Tuxar.`, cataloguePreview: true });
  }
}
assert.equal(additions.length, 19);
assert.equal(imageMap.length, 32);
catalogue.products = [...preserved, ...additions];
const url = 'https://www.next.co.uk/style/su468021/ah4252';
catalogue.pricingSources = [...catalogue.pricingSources.filter(source => source.url !== url), { url, checked: '2026-10-25', observed: 'Sosandar women’s collared leather jacket £275; proposed Tuxar local prices £179–£229 vary by design, not a verified market average. Confirm costs/margin.' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-basic-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ newProducts: additions.length, images: imageMap.length, videosImported: 0, localOnly: true, networkWrites: 0 }));
