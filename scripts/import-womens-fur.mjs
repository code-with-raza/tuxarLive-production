import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const batchId = 'womens-fur-01';
const families = [
  { id: 0, key: 'slim-fur-collar', title: 'Fur-Collar Slim Leather Jacket', price: 189, excluded: [11], detail: 'a fur-style collar, panelled body and front zip', items: [
    ['Burgundy', '#682c35', [[1, 'model-front']], 'The burgundy body contrasts with a dark, plush collar. Its slim outline and straight zip work well over a plain top and dark denim. The available photograph shows this colourway worn from the front.'],
    ['Pink', '#cf969f', [[2, 'model-front'], [3, 'back']], 'Pale pink leather tones meet a dark collar on this fitted zip jacket. A horizontal back yoke and vertical seams define the rear, while the model photograph shows its waist-length proportions with jeans.'],
    ['Tan', '#b77c43', [[4, 'front'], [5, 'three-quarter']], 'A tan body and contrasting black fur-style collar give this zip jacket a distinctive finish. The front views show shaped seams, two zipped waist pockets and long sleeves with a simple cuff finish.'],
    ['Brown', '#644334', [[7, 'front'], [6, 'model-front']], 'Brown leather tones frame a dark plush collar, with a central zip and angled waist pockets keeping the front practical. Wear it with indigo denim to bring out the contrast between the body and collar.'],
    ['Black', '#171717', [[10, 'front'], [8, 'model-front'], [9, 'model-back']], 'An all-black collar-trim jacket with a central zip and shaped front panels. Zipped waist pockets sit at an angle, while the model views show the front and back without a belt or oversized hem.'],
  ] },
  { id: 1, key: 'cream-trim-zip-pocket', title: 'Cream-Trim Zip-Pocket Leather Jacket', price: 209, excluded: [8], detail: 'a cream fur-style collar, zipped pockets and buckle-belt hem', items: [
    ['Black', '#171717', [[1, 'front']], 'Cream collar, cuff and hem trims stand out against the black body. A matching buckle belt runs around the lower edge, with a front zip and zipped waist pockets completing the aviator-inspired design.'],
    ['Tan', '#b77c43', [[3, 'front'], [2, 'model-front']], 'Tan leather tones and cream plush trims give this short jacket a lighter contrast. The collar folds outward above the central zip; a buckle belt at the hem and zipped pockets add definition through the front.'],
    ['Cognac', '#99502e', [[5, 'front'], [4, 'model-back']], 'The cognac body has a warm reddish-brown tone, outlined by cream collar, cuff and hem trims. A low buckle belt shapes the edge, and the model-back photograph shows the horizontal shoulder seam and panelled back.'],
    ['Burgundy', '#672936', [[7, 'front'], [6, 'model-front']], 'Burgundy and cream create a strong contrast on this zip-pocket jacket. The cream collar frames the neckline, with matching trims at the cuffs and lower hem. A burgundy buckle belt finishes the short silhouette.'],
  ] },
  { id: 2, key: 'belted-fur-hood', title: 'Fur-Trim Hooded Belted Leather Coat', price: 249, excluded: [], detail: 'a fur-style hood, trimmed cuffs and tie waist belt', items: [
    ['Black', '#171717', [[1, 'model-front']], 'A black hooded coat with a tie waist and contrasting tan plush trim around the hood and cuffs. The longer body covers the waist, with front pockets visible in the model photograph.'],
    ['Brown', '#664333', [[3, 'front'], [2, 'model-back']], 'Brown leather tones meet cream fur-style hood and cuff trims on this belted coat. A central zip, vertical pockets and a self-tie waist define the front. The back view shows the hood resting over the shoulders.'],
    ['Tan', '#b77c43', [[4, 'front'], [5, 'back'], [6, 'three-quarter']], 'Tan leather tones contrast with black plush trim at the hood and cuffs. The matching tie belt draws in the waist above two vertical pockets. Front, back and three-quarter photographs show the longer hem and full hood shape.'],
  ] },
  { id: 3, key: 'contrast-fur-sleeve', title: 'Contrast Fur-Sleeve Leather Jacket', price: 229, excluded: [8], detail: 'textured black sleeves, a leather body and stand collar', items: [
    ['Black', '#171717', [[2, 'front'], [1, 'model-back']], 'A black leather body paired with full textured black sleeves. The stand collar has a fastening tab, while a concealed-looking centre fastening and vertical chest zip keep the body streamlined. The short hem is finished with small press-stud details.'],
    ['Burgundy', '#682c35', [[4, 'three-quarter'], [3, 'model-back']], 'Burgundy body panels sit between bold black fur-style sleeves. A stand collar, vertical chest zip and short straight hem define the silhouette. The three-quarter product photograph and rear model view show the contrast from both sides.'],
    ['Brown', '#74472f', [[7, 'three-quarter'], [6, 'back'], [5, 'model-front']], 'Brown leather tones and black textured sleeves make this short jacket distinct from a conventional collar-trim style. Its stand collar and front chest zip keep the centre neat, with a horizontal back yoke visible above the waist.'],
  ] },
];
const target = 'src/data/products/local-womens-jackets.json';
const catalogue = JSON.parse(await fs.readFile(target, 'utf8'));
const preserved = catalogue.products.filter(product => product.batchId !== batchId);
const products = [], imageMap = [];
const directory = 'src/assets/products/local-jacket-import';
await fs.mkdir(directory, { recursive: true });
for (const family of families) {
  const inventory = JSON.parse(await fs.readFile(`output/womens-fur-${family.id}/inventory.json`, 'utf8'));
  for (const [colour, hex, views, copy] of family.items) {
    const slug = `womens-${colour.toLowerCase()}-${family.key}-leather-${family.id === 2 ? 'coat' : 'jacket'}`;
    const name = `Women's ${colour} ${family.title}`;
    assert(!preserved.some(product => product.slug === slug), 'Slug collision');
    const gallery = [];
    for (const [id, view] of views) {
      const source = inventory.find(image => image.id === id)?.source;
      assert(source && /\.(png|jpe?g|webp|avif)$/i.test(source), 'Images only');
      assert(!family.excluded.includes(id), 'Promotional image excluded');
      const bytes = await fs.readFile(source);
      const hash = createHash('sha256').update(bytes).digest('hex');
      const destination = `${directory}/${slug}-${view}.webp`;
      await sharp(bytes).rotate().resize(1000, 1250, { fit: 'contain', background: '#ffffff', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85, effort: 4 }).toFile(destination);
      assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
      gallery.push(`/${destination}`);
      imageMap.push({ source, sha256: hash, path: `/${destination}`, alt: `${name} — ${view.replaceAll('-', ' ')}` });
    }
    products.push({ batchId, slug, name, tagline: `${colour} · Leather with fur-style detailing`, category: 'leather-jackets', priceGBP: family.price,
      currency: 'GBP', image: gallery[0], gallery, colors: [{ name: colour, hex }], sizes: [], material: 'Leather; fur trim composition unconfirmed', weight: '', rating: 0, reviewCount: 0,
      description: `${copy} Fur type and composition are awaiting supplier confirmation.`,
      specs: [{ label: 'Colour', value: colour }, { label: 'Design', value: family.detail }, { label: 'Trim', value: 'Fur-style texture; real or faux composition not verified' }, { label: 'Sizing', value: 'Size range and measurements awaiting confirmation' }],
      inStock: false, collections: ['leather-fur-jackets', 'best-sellers', ...(family.id === 2 ? ['women-leather-coats'] : [])], itemGroupId: `TX-WF-${family.id + 1}`,
      seoTitle: `Women's ${colour} ${['Fur-Collar Jacket', 'Fur-Trim Leather Jacket', 'Fur-Hood Leather Coat', 'Fur-Sleeve Jacket'][family.id]} | Tuxar`,
      seoDescription: `Women's ${colour.toLowerCase()} leather ${family.id === 2 ? 'coat' : 'jacket'} with ${family.detail}. View product photographs and details at Tuxar.`, cataloguePreview: true });
  }
}
assert.equal(new Set(products.map(product => product.slug)).size, 15);
catalogue.products = [...preserved, ...products];
catalogue.pricingSources = [...(catalogue.pricingSources ?? []).filter(source => !source.url.includes('riverisland.com') && !source.url.includes('sv019321')), {
  url: 'https://www.riverisland.com/c/women/coats-and-jackets?f-length=short&f-womens-style=leather-jackets', checked: '2026-10-25', observed: 'Faux leather/fur-trim jackets £79–£89; material comparison, not equivalent verified composition',
}, { url: 'https://www.next.co.uk/style/sv019321/y37243', checked: '2026-10-25', observed: 'LOAVIES faux leather/faux fur collar jacket £36 sale, £72 previous price; material comparison only' }];
await fs.writeFile(target, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile('output/womens-fur-image-map.json', JSON.stringify(imageMap, null, 2) + '\n');
console.log(JSON.stringify({ localOnly: true, products: products.length, images: imageMap.length, totalWomensDrafts: catalogue.products.length, videosImported: 0, networkWrites: 0 }));
