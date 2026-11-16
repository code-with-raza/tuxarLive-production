import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';
import { assertPublicEnvironment } from './public-env.mjs';

// Public GET requests only: no orders, messages, sign-ins, uploads or database writes.
const women = JSON.parse(await fs.readFile('src/data/products/approved-womens-catalogue.json', 'utf8')).products;
const manifest = JSON.parse(await fs.readFile('output/releases/tuxar-womens-approved-20261028/manifest.json', 'utf8'));
const report = { checkedAt: new Date().toISOString(), requests: [], checks: {}, problems: [], remoteWrites: 0 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
async function get(url, headers = {}) {
  const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  report.requests.push({ url, status: response.status, contentType: response.headers.get('content-type') });
  if (!response.ok) throw Error(`HTTP ${response.status}: ${url}`);
  return bytes;
}
try {
  const home = (await get('https://tuxar.co.uk/en')).toString();
  report.checks.homeCanonical = /rel="canonical"[^>]*href="https:\/\/tuxar\.co\.uk\/en"/.test(home);
  report.checks.homeHasInitialHeadings = /<h1\b/.test(home) && /<h2\b/.test(home);
  report.checks.homeHasInitialLinks = /<a\b[^>]*href="\/en\//.test(home);
  const script = home.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/i)?.[1];
  if (!script) throw Error('No main application script in live homepage');
  const expectedScript = manifest.files.find(file => `/${file.path}` === script);
  if (!expectedScript) throw Error('Live homepage references a different application bundle than the prepared release');
  report.checks.deployedBundleMatchesPrepared = hash(await get(new URL(script, 'https://tuxar.co.uk').href)) === expectedScript.sha256;
  const sitemap = (await get('https://tuxar.co.uk/sitemap.xml')).toString();
  report.checks.sitemapWomenProducts = women.filter(product => ['en','it','de','fr','es'].every(locale => sitemap.includes(`https://tuxar.co.uk/${locale}/product/${product.slug}`))).length === 94;
  report.sitemapUrlCount = (sitemap.match(/<loc>/g) ?? []).length;
  for (const path of ['/en/women-leather-jackets', '/en/collections/women-leather-hood-jackets', `/en/product/${women[0].slug}`, '/en/product/classic-zip-quilted']) await get(`https://tuxar.co.uk${path}`);
  const charts = [
    ['womenChart', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793050563/women-vest-size-chart.webp', 'public/size-charts/womens-jackets.webp'],
    ['menChart', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793130084/mens-jackets-size-chart.webp', 'public/size-charts/mens-jackets.webp'],
    ['menRepairPhoto', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793051072/classic-zip-new.webp', 'src/assets/products/classic/zip_new.webp'],
  ];
  for (const [name, url, source] of charts) report.checks[name] = hash(await get(url)) === hash(await fs.readFile(source));
  const back = manifest.files.find(file => /^assets\/zip4-[^/]+\.webp$/.test(file.path));
  if (back) report.checks.bundledMenBackPhoto = hash(await get(`https://tuxar.co.uk/${back.path}`)) === back.sha256;
  const environment = loadEnv('production', process.cwd(), 'VITE_SUPABASE_');
  assertPublicEnvironment(environment);
  const base = environment.VITE_SUPABASE_URL;
  if (new URL(base).hostname !== 'ncgxljatjajgcvnlrncm.supabase.co') throw Error('Configured backend is not Tuxar Production');
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
  const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };
  const rows = [];
  for (let offset = 0; offset < women.length; offset += 20) {
    const params = new URLSearchParams({ select: 'slug,status,price_pence,product_images(url,position),product_variants(sku,size,color,stock,active)', slug: `in.(${women.slice(offset, offset + 20).map(product => product.slug).join(',')})` });
    rows.push(...JSON.parse((await get(`${base}/rest/v1/products?${params}`, headers)).toString()));
  }
  report.activeWomenProducts = rows.filter(row => row.status === 'active').length;
  report.activeWomenVariants = rows.reduce((sum, row) => sum + row.product_variants.filter(variant => variant.active).length, 0);
  report.checks.all94WomenActive = report.activeWomenProducts === 94;
  report.checks.all752VariantsActive = report.activeWomenVariants === 752;
  report.checks.approvedPricesMatch = rows.length === 94 && rows.every(row => row.price_pence === Math.round(women.find(product => product.slug === row.slug).priceGBP * 100));
  report.checks.allWomenPhotosMatch = rows.length === 94 && rows.every(row => {
    const expected = women.find(product => product.slug === row.slug).gallery;
    return row.product_images.length === expected.length && [...row.product_images].sort((a,b) => a.position-b.position).every((image,index) => image.url === expected[index]);
  });
  report.checks.variantsHaveValidStock = rows.every(row => row.product_variants.every(variant => Number.isInteger(variant.stock) && variant.stock >= 0));
  for (const [name, passed] of Object.entries(report.checks)) if (!passed) report.problems.push(name);
} catch (error) { report.problems.push(error.message); }
await fs.mkdir('output/live-release-check', { recursive: true });
await fs.writeFile('output/live-release-check/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks: report.checks, activeWomenProducts: report.activeWomenProducts, activeWomenVariants: report.activeWomenVariants, sitemapUrlCount: report.sitemapUrlCount, problems: report.problems, remoteWrites: 0 }, null, 2));
if (report.problems.length) process.exitCode = 1;
