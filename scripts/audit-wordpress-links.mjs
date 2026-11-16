import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPolicy } from './wordpress-retirement-policy.mjs';
const policy = await loadPolicy();
const violations = [];
let checkedFiles = 0, checkedUrls = 0;
async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (/\.(tsx?|jsx?|json|html|xml|md)$/.test(entry.name)) files.push(file);
  }
  return files;
}
for (const file of [...await walk('src'), ...await walk('public'), ...await walk('dist/prerender-home'), ...await walk('dist/prerender-pages')]) {
  const content = await fs.readFile(file, 'utf8');
  checkedFiles++;
  const urls = [
    ...[...content.matchAll(/(?:href|to|action|canonical|url)["']?\s*[:=]\s*["']((?:https?:\/\/|\/)[^"'<>\s]+)["']/g)].map(match => match[1]),
    ...[...content.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]),
    ...[...content.matchAll(/\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g)].map(match=>match[1]),
  ];
  for (const value of urls) {
    if (value.includes('${') || value.includes('$locale')) continue;
    let url;
    try { url = new URL(value.replaceAll('&amp;', '&'), 'https://tuxar.co.uk'); } catch { continue; }
    if (!['tuxar.co.uk', 'www.tuxar.co.uk'].includes(url.hostname)) continue;
    checkedUrls++;
    if (policy.decide(url.href).status !== 200) violations.push({ file, url: url.href });
  }
}
const report = { checkedFiles, checkedUrls, violations, scope: 'Literal source and Markdown URL fields, JSON-LD URL fields, sitemap locations/alternate links, all five prerendered homepages and every generated public-page HTML file. Dynamic CMS-only content and authenticated pages are outside this static URL audit.' };
await fs.writeFile('output/wordpress-retirement-20261028/link-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (violations.length) process.exitCode = 1;
