import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const bags = JSON.parse(await fs.readFile('src/data/products/local-bags.json', 'utf8'));
const manifestPath = 'src/data/cloudinary-assets.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const verified = [];
for (const product of bags.products) {
  for (const source of product.gallery) {
    const publicId = path.basename(source, '.webp');
    const version = publicId === 'tan-structured-flap-backpack-01' ? 'v1793556569/' : '';
    const url = `https://res.cloudinary.com/rllwk4bi/image/upload/${version}${publicId}.png`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error(`${publicId}: HTTP ${response.status}`);
    const uploaded = Buffer.from(await response.arrayBuffer());
    const original = await fs.readFile(path.join(bags.sourceFolder, product.slug, publicId + '.png'));
    const metadata = await sharp(uploaded).metadata();
    // Confirm the uploaded photo is the expected bag/view before connecting it.
    const uploadedPixels = await sharp(uploaded).ensureAlpha().raw().toBuffer();
    const originalPixels = await sharp(original).ensureAlpha().raw().toBuffer();
    if (hash(uploadedPixels) !== hash(originalPixels)) throw Error(`${publicId}: uploaded photo differs from the approved local edit`);
    manifest[source] = { source: source.slice(1), url, publicId, width: metadata.width, height: metadata.height, format: 'png', altText: product.name, title: product.name };
    verified.push({ source, publicId, url, status: response.status, pixelMatch: true, width: metadata.width, height: metadata.height });
  }
}
// Commit mappings only after every gallery photo has passed verification.
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile('output/bags-prepared-20261101/cloudinary-verification.json', JSON.stringify(verified, null, 2) + '\n');
console.log(`Verified and connected ${verified.length} Cloudinary photos across ${bags.products.length} bags.`);
