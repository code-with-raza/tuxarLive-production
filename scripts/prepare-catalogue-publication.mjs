import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const catalogue = JSON.parse(await fs.readFile('src/data/products/local-jackets.json', 'utf8'));
const slugs = new Set(), skus = new Set(), images = new Map();
for (const product of catalogue.products) {
  if (slugs.has(product.slug)) throw new Error('Duplicate product slug');
  slugs.add(product.slug);
  if (!Number.isFinite(product.priceGBP) || product.priceGBP <= 0) throw new Error('Invalid price');
  const variants = catalogue.variants.filter(v => v.productSlug === product.slug);
  if (variants.length !== 4 || !['M','L','XL','XXL'].every(size => variants.some(v => v.size === size))) throw new Error('Invalid sizes');
  for (const variant of variants) {
    if (variant.stock !== 10 || skus.has(variant.sku)) throw new Error('Invalid stock or duplicate SKU');
    skus.add(variant.sku);
  }
  for (const image of product.gallery) {
    if (!/^\/src\/assets\/products\/local-jacket-import\/[a-z0-9-]+\.webp$/.test(image)) throw new Error('Unexpected image path');
    if (!images.has(image)) {
      const bytes = await fs.readFile(image.slice(1));
      if (bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WEBP') throw new Error('Not WebP');
      images.set(image, { localPath:image, sha256:createHash('sha256').update(bytes).digest('hex'), cloudinaryUrl:null });
    }
  }
}
const output = 'output/catalogue-publication';
await fs.mkdir(output, {recursive:true});
const plan = {
  status:'PREPARED ONLY — NO REMOTE WRITES',
  projectReference:'ncgxljatjajgcvnlrncm',
  counts:{products:slugs.size, variants:skus.size, images:images.size},
  prerequisites:[
    'Authenticated Cloudinary upload access and Supabase catalogue write access',
    'Read-only production schema/category/slug/SKU collision check and verified backup',
    'Upload images and verify returned URLs before creating catalogue records',
    'Preserve existing products and stock; never replay the historical seed script',
    'Include approved catalogue in production frontend discovery, product lookup and sitemap',
    'Rebuild and verify cPanel package after successful publication preparation'
  ],
  products:catalogue.products,
  variants:catalogue.variants,
  images:[...images.values()]
};
await fs.writeFile(`${output}/publication-manifest.json`, JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,...plan.counts}));
