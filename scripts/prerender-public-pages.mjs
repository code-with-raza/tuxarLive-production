import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer, createServerModuleRunnerTransport, loadEnv } from 'vite';
import { ModuleRunner, createNodeImportMeta } from 'vite/module-runner';
import { verifyHomepageHtml } from './verify-homepage-html.mjs';
import { inspectPublicHtml } from './verify-public-locale-html.mjs';
const locales = ['en','it','de','fr','es'];
const template = await fs.readFile('dist/index.html', 'utf8');
const sitemap = await fs.readFile('dist/sitemap.xml','utf8');
let urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const originalUrls = new Set(urls);
const builtAssets = await fs.readdir('dist/assets');
if (new Set(urls).size !== urls.length) throw Error('Duplicate sitemap URLs');
console.log('Preparing the public page renderer…');
const server = await createServer({ mode: 'production', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const runner = new ModuleRunner({
  transport: { ...createServerModuleRunnerTransport({ channel: server.environments.ssr.hot }), timeout: 300000 },
  createImportMeta: createNodeImportMeta, hmr: false, sourcemapInterceptor: false,
});
try {
  // Warm the large catalogue outside the module runner's short transport timeout.
  console.log('Preparing catalogue modules…');
  await server.transformRequest('/src/assets/index.ts', { ssr: true });
  await server.transformRequest('/src/data/products.ts', { ssr: true });
  console.log('Loading public route modules…');
  const { renderPublicPage, publishedPublicUrls } = await runner.import('/src/prerender-home.tsx');
  console.log('Reading active product status and prices…');
  urls = await publishedPublicUrls(urls);
  const environment = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
  const paths = new Set(['/']);
  for (const url of urls) {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    paths.add(pathname);
    paths.add(pathname.replace(/^\/(en|de|fr|it|es)(?=\/|$)/, '') || '/');
  }
  for (const file of await fs.readdir('src/routes')) {
    if (!file.endsWith('.tsx') || file === '__root.tsx') continue;
    const route = file.slice(0, -4).replace(/\.index$/, '').replace(/_(?=\.|$)/g, '');
    if (route.replace('$locale', '').includes('$')) continue;
    const pathname = route === 'index' ? '/' : '/' + route.replaceAll('.', '/');
    for (const locale of locales) paths.add(pathname.replace('$locale', locale));
  }
  const { PRODUCT_SLUG_MAP } = await runner.import('/src/i18n/i18n.ts');
  const productSlugs = Object.fromEntries(Object.entries(PRODUCT_SLUG_MAP).flatMap(([canonical, translations]) => Object.values(translations).map(slug => [slug, canonical])));
  await fs.writeFile('dist/server-routes.json', JSON.stringify({ paths:[...paths].sort(), productSlugs, supabaseUrl:environment.VITE_SUPABASE_URL, publishableKey:environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY })+'\n');
  console.log('Rendering ' + urls.length + ' published public pages…');
  const published = new Set(urls);
  await fs.writeFile('dist/sitemap.xml', sitemap.replace(/\s*<url>[\s\S]*?<\/url>/g, block => published.has(block.match(/<loc>([^<]+)<\/loc>/)?.[1]) ? block : ''));
  const report = [], homes = [];
  for (const url of urls) {
    const pathname = new URL(url).pathname, locale = pathname.split('/')[1];
    if (!locales.includes(locale) || /\/(admin|checkout|account|login)(\/|$)/.test(pathname)) throw Error(`Non-public sitemap entry: ${url}`);
    let body = await renderPublicPage(pathname);
    // Vite's source renderer returns source paths for imported bitmap assets;
    // the deployed HTML must reference their already-built, hashed filenames.
    body = body.replace(/\/src\/assets\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g|svg|avif)/g, source => {
      const extension = path.extname(source), stem = path.basename(source,extension);
      const matches = builtAssets.filter(file=>file.startsWith(`${stem}-`)&&file.endsWith(extension));
      return matches.length===1 ? `/assets/${matches[0]}` : source;
    });
    if (body.includes('/src/assets/') || body.includes('Local catalogue preview')) throw Error(`Unpublished/source asset in ${url}: ${[...new Set(body.match(/\/src\/assets\/[^"<>\s]+/g) ?? [])].slice(0,12).join(', ')}`);
    const tags = [];
    body = body.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, tag => { tags.push(tag); return ''; });
    body = body.replace(/<title\b[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>/gi, tag => {
      if (!/^<meta\b[^>]*(?:charSet=|name="(?:viewport|theme-color)")/i.test(tag) && !/^<link\b[^>]*rel="(?:icon|preconnect|dns-prefetch)"/i.test(tag)) tags.push(tag);
      return '';
    });
    const head = tags.map(tag => tag.replace(/^<(\w+)/, '<$1 data-tuxar-static-head=""')).join('\n');
    const html = template.replace('<html lang="en">', `<html lang="${locale}">`).replace('</head>', () => `${head}\n<style data-tuxar-static-head="">#root[data-prerendered-home] .luxe-reveal{opacity:1;transform:none}</style>\n</head>`).replace('<div id="root"></div>', () => `<div id="root" data-prerendered-home="">${body}</div>`);
    const inspected = inspectPublicHtml(html, url), home = pathname === `/${locale}`;
    const file = home ? `dist/prerender-home/${locale}.html` : `dist/prerender-pages${pathname}/index.html`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, html);
    report.push({ ...inspected, file });
    if (home) { verifyHomepageHtml(html, locale); homes.push({ path: pathname, canonical: url, h2Count: (body.match(/<h2\b/g) ?? []).length, internalLinks: (body.match(/<a\b[^>]*href="\//g) ?? []).length }); }
    if (report.length % 100 === 0) console.log(`Verified public HTML: ${report.length}/${urls.length}`);
  }
  const byUrl = new Map(report.map(row => [row.url,row]));
  for (const row of report) for (const alternate of Object.values(row.alternates)) if (byUrl.get(alternate)?.alternates[row.locale] !== row.url) throw Error(`Non-reciprocal hreflang: ${row.url}`);
  const addedArticles = report.filter(row => !originalUrls.has(row.url));
  {
    const escapeXml = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    const articleLinks = row => Object.entries(row.alternates).map(([language,href]) => `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(href)}"/>`).join('');
    const extra = addedArticles.map(row => `<url><loc>${escapeXml(row.url)}</loc>${Object.entries(row.alternates).map(([language,href]) => `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(href)}"/>`).join('')}</url>`).join('\n');
    const current = await fs.readFile('dist/sitemap.xml','utf8');
    const updated = current.replace(/<url>[\s\S]*?<\/url>/g, block => {
      const url = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
      const row = byUrl.get(url);
      if (!row || !/\/(en|de|es|fr|it)\/blog\//.test(new URL(url).pathname)) return block;
      return block.replace(/\s*<xhtml:link\b[^>]*\/>/g, '').replace('</url>', `${articleLinks(row)}</url>`);
    });
    await fs.writeFile('dist/sitemap.xml', updated.replace('</urlset>', `${extra}\n</urlset>`));
  }
  await fs.mkdir('output/prerender-homepages', { recursive: true });
  await fs.writeFile('output/prerender-homepages/report.json',JSON.stringify(homes,null,2)+'\n');
  await fs.mkdir('output/multilingual-audit-20261028', { recursive: true });
  await fs.writeFile('output/multilingual-audit-20261028/prerender-report.json',JSON.stringify({ pages:report.length, byLocale:Object.fromEntries(locales.map(locale=>[locale,report.filter(row=>row.locale===locale).length])), reciprocalHreflang:true, rows:report },null,2)+'\n');
  console.log(`Prerendered and verified ${report.length} public pages across all five locales.`);
} finally { await runner.close(); await server.close(); }
