import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const output = 'output/wordpress-retirement-20261028';
const downloads = 'C:/Users/Ahmad/Downloads';
const workbooks = (await fs.readdir(downloads)).filter(name => /^tuxar\.co\.uk-Coverage.*\.xlsx$/.test(name));
const files = [
  'tests/fixtures/legacy-wordpress-soft404.json',
  'tests/fixtures/legacy-wordpress-404.json',
  'output/legacy-404-audit-2026-10-18/source-extract.json',
  'output/discovered-indexing-2026-10-18/workbook-extract.json',
  'output/indexing-audit-2026-10-21/workbook.json',
];
const urls = new Map(), sources = [];
function visit(value, source) {
  if (typeof value === 'string' && /^https?:\/\/(?:www\.)?tuxar\.co\.uk(?:[/?#]|$)/i.test(value)) {
    const url = new URL(value).href;
    if (!urls.has(url)) urls.set(url, new Set());
    urls.get(url).add(source);
  } else if (value && typeof value === 'object') Object.values(value).forEach(child => visit(child, source));
}
for (const file of [...files, ...workbooks.map(name => path.join(downloads, name))]) {
  const bytes = await fs.readFile(file);
  let data;
  if (file.endsWith('.xlsx')) {
    const result = spawnSync('python', ['scripts/read-gsc-workbook.py', file], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Cannot read workbook: ${file}: ${result.stderr}`);
    data = JSON.parse(result.stdout);
  } else data = JSON.parse(bytes.toString());
  visit(data, file);
  sources.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const rows = [...urls].sort(([a], [b]) => a.localeCompare(b)).map(([url, foundIn]) => ({ url, sources: [...foundIn] }));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(`${output}/source-urls.json`, JSON.stringify({ sources, urls: rows, scope: 'All Tuxar Coverage workbooks available in Downloads plus prior saved Search Console extracts. Not a direct Search Console account export.' }, null, 2));
const legacy = rows.filter(({ url }) => { const parsed = new URL(url); return !/^\/(en|it|de|fr|es)(\/|$)/.test(parsed.pathname) && !['/', '/robots.txt', '/sitemap.xml'].includes(parsed.pathname) || parsed.search; });
console.log(JSON.stringify({ sources: sources.length, urls: rows.length, legacy: legacy.map(row => row.url) }, null, 2));
