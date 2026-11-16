import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Read-only CDN checks. Never uploads assets or publishes catalogue records.
const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
const sampleName = 'womens-yellow-black-contrast-panel-motorcycle-leather-jacket-model-front.webp';
const paths = [...new Set(catalogue.products.flatMap(product => [product.image, ...product.gallery]))];
const results = [];
let cursor = 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < paths.length) {
    const localPath = paths[cursor++];
    if (!/^\/src\/assets\/products\/local-jacket-import\/[a-z0-9-]+\.webp$/.test(localPath)) throw Error('Unexpected local image path');
    const name = path.posix.basename(localPath);
    const url = `https://res.cloudinary.com/rllwk4bi/image/upload/${name === sampleName ? 'v1793050561/' : ''}${name}`;
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        if (!response.headers.get('content-type')?.startsWith('image/')) throw Error('Not an image response');
        if (Number(response.headers.get('content-length')) > 5_000_000) throw Error('Unexpected image size');
        const bytes = Buffer.from(await response.arrayBuffer());
        const original = await fs.readFile(localPath.slice(1));
        if (hash(bytes) !== hash(original)) throw Error('Remote photo differs from the local original');
        result = { localPath, url, verified: true, sha256: hash(bytes) };
        break;
      } catch (error) { result = { localPath, url, verified: false, error: error.message }; }
    }
    results.push(result);
    if (results.length % 40 === 0) console.log(`${results.length}/${paths.length} checked`);
  }
}));
results.sort((a, b) => a.localPath.localeCompare(b.localPath));
await fs.mkdir('output', { recursive: true });
await fs.writeFile('output/womens-cloudinary-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(JSON.stringify({ images: results.length, verified: results.filter(result => result.verified).length, failed: results.filter(result => !result.verified).length, remoteWrites: 0 }));
if (results.some(result => !result.verified)) process.exitCode = 1;
