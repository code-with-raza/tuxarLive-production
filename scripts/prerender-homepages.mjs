import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { verifyHomepageHtml } from './verify-homepage-html.mjs';

const locales = ['en', 'it', 'de', 'fr', 'es'];
const template = await fs.readFile('dist/index.html', 'utf8');
const server = await createServer({ mode: 'production', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { renderHomepage } = await server.ssrLoadModule('/src/prerender-home.tsx');
  await fs.mkdir('dist/prerender-home', { recursive: true });
  const report = [];
  for (const locale of locales) {
    let body = await renderHomepage(locale);
    if (body.includes('/src/assets/') || body.includes('Local catalogue preview')) throw Error(`Unpublished/source asset in ${locale} homepage`);
    const tags = [];
    body = body.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, tag => { tags.push(tag); return ''; });
    body = body.replace(/<title\b[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>/gi, tag => {
      // The document template already owns these stable resource hints/settings.
      if (!/^<meta\b[^>]*(?:charSet=|name="(?:viewport|theme-color)")/i.test(tag) && !/^<link\b[^>]*rel="(?:icon|preconnect|dns-prefetch)"/i.test(tag)) tags.push(tag);
      return '';
    });
    const head = tags.map(tag => tag.replace(/^<(\w+)/, '<$1 data-tuxar-static-head=""')).join('\n');
    const canonical = `https://tuxar.co.uk/${locale}`;
    if (!head.includes(`rel="canonical" href="${canonical}"`) || (head.match(/rel="canonical"/g) ?? []).length !== 1) throw Error(`Invalid canonical for ${locale}`);
    if (!/<h2\b/.test(body) || !/<a\b[^>]*href="\//.test(body)) throw Error(`Missing crawlable homepage content: ${locale}`);
    const html = template.replace('<html lang="en">', `<html lang="${locale}">`)
      .replace('</head>', () => `${head}\n<style data-tuxar-static-head="">#root[data-prerendered-home] .luxe-reveal{opacity:1;transform:none}</style>\n</head>`)
      .replace('<div id="root"></div>', () => `<div id="root" data-prerendered-home="">${body}</div>`);
    verifyHomepageHtml(html, locale);
    await fs.writeFile(`dist/prerender-home/${locale}.html`, html);
    report.push({ path: `/${locale}`, canonical, h2Count: (body.match(/<h2\b/g) ?? []).length, internalLinks: (body.match(/<a\b[^>]*href="\//g) ?? []).length });
  }
  await fs.mkdir('output/prerender-homepages', { recursive: true });
  await fs.writeFile('output/prerender-homepages/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Prerendered ${report.length} public homepages with canonicals, H2 headings and crawlable links.`);
} finally { await server.close(); }
