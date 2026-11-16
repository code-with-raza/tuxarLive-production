import fs from 'node:fs/promises';
import { loadPolicy, begin, end } from './wordpress-retirement-policy.mjs';
const policy = await loadPolicy();
await fs.mkdir('output/wordpress-retirement-20261028', { recursive: true });
const hosting = (await fs.readFile('public/.htaccess', 'utf8')).replaceAll('\r\n', '\n');
let next;
if (hosting.includes(begin)) next = hosting.slice(0, hosting.indexOf(begin)) + policy.block + hosting.slice(hosting.indexOf(end) + end.length);
else {
  const start = hosting.indexOf('# BEGIN TUXAR LEGACY WORDPRESS URLS');
  const last = '# END TUXAR LEGACY 404 EXPORT';
  if (start < 0 || hosting.indexOf(last) < start) throw new Error('Expected legacy rules not found; refusing an unsafe replacement.');
  next = hosting.slice(0, start) + policy.block + hosting.slice(hosting.indexOf(last) + last.length);
}
const admin = '  # WordPress administration is forbidden before host redirects and SPA dispatch.\n  RewriteRule ^wp-admin(?:/|$) - [F,L,NC]\n';
if (!next.includes('RewriteRule ^wp-admin(?:/|$)')) next = next.replace('  RewriteBase /\n', '  RewriteBase /\n\n' + admin);
await fs.writeFile('public/.htaccess', next);
const rows = policy.source.urls.map(row => ({ ...row, ...policy.decide(row.url) }));
const legacy = rows.filter(row => row.status !== 200);
await fs.writeFile('output/wordpress-retirement-20261028/url-decisions.json', JSON.stringify({ scope: policy.source.scope, reviewed: rows.length, legacy: legacy.length, rows }, null, 2));
const report = ['# WordPress retirement verification list', '', 'Prepared 28 October 2026 (Asia/Karachi). This is a deployment plan, not evidence of deployment.', '', `Reviewed ${rows.length} unique URLs from ${policy.source.sources.length} saved sources. ${legacy.length} legacy URLs require server handling.`, '', '| Search Console URL | Intended status | Exact destination | Evidence / decision |', '| --- | --- | --- | --- |', ...legacy.map(row => `| ${row.url.replaceAll('|', '%7C')} | ${row.status} | ${row.destination ?? 'None'} | ${row.reason} |`), '', 'Native curl headers after deployment: pending upload. Run scripts/verify-wordpress-retirement-curl.mjs --after-deployment. It writes every raw response header, exact status/location comparisons, redirect target checks and current-route controls. No post-deployment success is claimed by this plan.', '', 'Products are never matched by similar colour, material or style. Unknown product IDs/page IDs cannot be inferred from a slug or a current product name. Tags and broad article topics are not category/product identities.', '', 'Old product-category motorcycle-gloves maps to the current accessories category, whose saved title is Leather Motorcycle Gloves. Aviator, bomber and textile categories map to their corresponding populated English collection URLs. The remaining old nested categories have no confirmed identical current scope.', '', 'References: [Apache flags](https://httpd.apache.org/docs/2.4/rewrite/flags.html), [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).'];
await fs.writeFile('output/wordpress-retirement-20261028/VERIFICATION-LIST.md', report.join('\n').replace('Aviator, bomber and textile categories map to their corresponding populated English collection URLs.', 'Bomber, textile and leather-puffer categories map to their corresponding populated English collection URLs. The separate Aviator Jackets collection is unpublished, so its old category has no confirmed published destination and returns 410.') + '\n');
console.log(JSON.stringify({ reviewed: rows.length, legacy: legacy.length, redirects: legacy.filter(row => row.status === 301).length, gone: legacy.filter(row => row.status === 410).length, exactResourceMaps: policy.maps.size, oldArticles: policy.articles.size }));
