import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const images = [
  ['women-chart', 'public/size-charts/womens-jackets.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793050563/women-vest-size-chart.webp'],
  ['repair-front', 'src/assets/products/classic/zip_new.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793051072/classic-zip-new.webp'],
  ['men-chart', 'public/size-charts/mens-jackets.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793130084/mens-jackets-size-chart.webp'],
];
const results = [];
for (const [id, localPath, url] of images) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error(`${id}: HTTP ${response.status}`);
  const remote = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(localPath);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (hash(remote) !== hash(local)) throw Error(`${id}: uploaded file differs from the supplied original`);
  results.push({ id, localPath, url, sha256: hash(remote), verified: true });
}
await fs.mkdir('output', { recursive: true });
await fs.writeFile('output/size-chart-upload-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(JSON.stringify({ verified: results.length, remoteWrites: 0 }));
