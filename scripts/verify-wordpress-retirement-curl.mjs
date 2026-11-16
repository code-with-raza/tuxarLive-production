import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadPolicy, origin } from './wordpress-retirement-policy.mjs';
const exec = promisify(execFile);
const after = process.argv.includes('--after-deployment');
const output = `output/wordpress-retirement-20261028/${after ? 'after-deployment' : 'live-baseline'}`;
await fs.mkdir(`${output}/headers`, { recursive: true });
const policy = await loadPolicy();
const rows = [];
async function probe(url, expected, expectedLocation, label) {
  if (new URL(url).origin !== origin) throw new Error('Refusing a cross-origin probe');
  const index = String(rows.length + 1).padStart(3, '0');
  const args = ['--silent', '--show-error', '--head', '--path-as-is', '--max-time', '20', '--proto', '=https', '--user-agent', 'Tuxar-legacy-retirement-header-audit/1.0', url];
  let row;
  try {
    const { stdout } = await exec('curl.exe', args, { maxBuffer: 128 * 1024 });
    const raw = stdout.replace(/^set-cookie:.*$/gim, 'Set-Cookie: [value redacted]');
    const status = Number([...stdout.matchAll(/^HTTP\/\S+ (\d{3})/gm)].at(-1)?.[1]);
    const location = stdout.match(/^location:\s*(.+)$/im)?.[1].trim();
    row = { url, label, expected, expectedLocation, status, location, pass: status === expected && location === expectedLocation, headers: `headers/${index}.txt`, curl: ['curl.exe', ...args] };
    await fs.writeFile(`${output}/${row.headers}`, raw);
  } catch (error) { row = { url, label, expected, expectedLocation, pass: false, error: error.message }; }
  rows.push(row);
  return row;
}
let deployed = false;
if (after) {
  // Refuse to send any obsolete cart actions until harmless probes prove the
  // new terminal path/query guards and administrative protection are deployed.
  const guards = [];
  for (const [path, status] of [['/product/__tuxar-retirement-probe__/', 410], ['/?ND', 410], ['/wp-admin/', 403]]) guards.push(await probe(origin + path, status, undefined, 'Deployment guard'));
  deployed = guards.every(row => row.pass);
}
if (!after || deployed) {
  for (const item of policy.source.urls) {
    const decision = policy.decide(item.url);
    if (decision.status === 200) continue;
    // A pre-deployment HEAD request could still activate old WooCommerce code.
    if (!after && /add.to.cart/i.test(decodeURIComponent(item.url))) {
      rows.push({ url: item.url, expected: decision.status, expectedLocation: decision.destination, skipped: 'Obsolete cart query is not sent before deployment is confirmed.' });
      continue;
    }
    await probe(item.url, decision.status, decision.destination, 'Search Console URL');
  }
  for (const path of ['/en/shop?q=leather&page=2&sort=price&utm_source=audit', '/en/product/classic-button-trucker', '/en/checkout?session_id=cs_public_example', '/en/confirmation?orderNumber=cs_public_example', '/en/login?returnTo=%2Fen%2Fcheckout', '/en/wishlist', '/fr/collections/vestes-biker', '/robots.txt', '/sitemap.xml']) await probe(origin + path, 200, undefined, 'Current route control');
  const patternPaths = ['/product/classic-button-trucker/', '/product-category/motorcycle-jacket/leather-jacket/puffer-jacket/', '/wishlist/', '/how-real-italian-leather-is-tanned/', '/?SA', '/?MD', '/?page_id=9999', '/?paged=7', '/?post_type=product', '/?product=classic-button-trucker', '/?product=__retired_probe__', '/?add-to-cart=9999', '/product-tag/__retired_probe__/', '/tag/__retired_probe__/', '/category/__retired_probe__/'];
  if (after) for (const path of patternPaths) await probe(origin + path, policy.decide(path).status, policy.decide(path).destination, 'Pattern verification');
  const destinations = new Set(policy.source.urls.map(item => policy.decide(item.url).destination).filter(Boolean));
  if (after) for (const path of patternPaths) {
    const decision = policy.decide(path);
    if (decision.destination) destinations.add(decision.destination);
  }
  for (const destination of destinations) await probe(destination, 200, undefined, 'Redirect destination: must not redirect again');
}
const report = { phase: after ? 'after-deployment' : 'before-deployment baseline: not a deployment success report', checkedAt: new Date().toISOString(), deploymentConfirmedByGuards: deployed, blocked: after && !deployed, failures: rows.filter(row => row.pass === false).length, skipped: rows.filter(row => row.skipped).length, results: rows, method: 'Native curl.exe HEAD, no redirects followed, no authentication, no cookies, no orders/payment sessions created.' };
await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
const md = ['# Native curl header verification', '', `Phase: **${report.phase}**`, `Checked at: ${report.checkedAt}`, '', after && !deployed ? '**New rules are not deployed. Cart query verification was not attempted. Upload the reviewed files and rerun.**' : '', '', '| URL | Intended | Actual | Intended Location | Actual Location | Header file |', '| --- | --- | --- | --- | --- | --- |', ...rows.map(row => `| ${row.url} | ${row.expected} | ${row.skipped ? 'SKIPPED' : row.status ?? 'ERROR'} | ${row.expectedLocation ?? 'None'} | ${row.location ?? 'None'} | ${row.headers ? `[headers](${row.headers})` : row.skipped ?? row.error ?? ''} |`)];
await fs.writeFile(`${output}/CURL-RESULTS.md`, md.join('\n') + '\n');
console.log(JSON.stringify({ output, phase: report.phase, deploymentConfirmed: deployed, failures: report.failures, skipped: report.skipped, requests: rows.filter(row => !row.skipped).length }));
if (after && (report.blocked || report.failures)) process.exitCode = 1;
