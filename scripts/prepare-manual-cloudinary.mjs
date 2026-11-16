import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Offline preparation only. No network, credentials, database writes or publication.
const root = path.resolve('output/cloudinary-manual-upload');
const entries = new Map();
for (const audience of ['men', 'women']) {
  const catalogue = JSON.parse(await fs.readFile(`src/data/products/${audience === 'men' ? 'local-jackets' : 'local-womens-jackets'}.json`, 'utf8'));
  for (const product of catalogue.products) for (const source of new Set([product.image, ...product.gallery].filter(Boolean))) {
    if (!/^\/src\/assets\/products\/local-jacket-import\/[a-z0-9-]+\.webp$/.test(source)) throw Error(`Unexpected path: ${source}`);
    const publicId = path.basename(source, '.webp');
    const existing = entries.get(publicId);
    if (existing && existing.source !== source) throw Error(`Filename collision: ${publicId}`);
    entries.set(publicId, { audience, source, publicId, uploadFile: `${audience}/${publicId}.webp` });
  }
}
for (const [filename, publicId] of [['zip_new.webp', 'classic-zip-new'], ['zip4.webp', 'classic-zip4']]) {
  const id = `tuxar/website/product/${publicId}`;
  entries.set(id, { audience: 'repair', source: `/src/assets/products/classic/${filename}`, publicId: id, uploadFile: `repair/${publicId}.webp` });
}
for (const entry of entries.values()) {
  const bytes = await fs.readFile(entry.source.slice(1));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error(`Not WebP: ${entry.source}`);
  const target = path.join(root, entry.uploadFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(entry.source.slice(1), target);
  entry.sha256 = createHash('sha256').update(bytes).digest('hex');
  entry.expectedUrl = `https://res.cloudinary.com/rllwk4bi/image/upload/${entry.publicId}.webp`;
}
const manifest = { status: 'OFFLINE ONLY; expected URLs are NOT verified uploads', cloudName: 'rllwk4bi', images: [...entries.values()] };
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ folder: root, counts: Object.fromEntries(['men', 'women', 'repair'].map(a => [a, manifest.images.filter(e => e.audience === a).length])), status: manifest.status }));
