import { createServer } from 'vite';
import fs from 'node:fs/promises';
const dictionaries = Object.fromEntries(await Promise.all(['en','de','es','fr','it'].map(async locale => [locale,JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'))])));
const server = await createServer({ mode:'production', optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true,hmr:false}, appType:'custom' });
try {
  const { renderPublicPage } = await server.ssrLoadModule('/src/prerender-home.tsx');
  const slug = 'womens-black-cape-shoulder-belted-leather-jacket';
  for (const locale of ['en','de','es','fr','it']) for (const suffix of ['',`/product/${dictionaries[locale].products?.[slug]?.slug ?? slug}`,'/shipping-policy']) {
    const path = `/${locale}${suffix}`;
    const html = await renderPublicPage(path);
    console.log(JSON.stringify({ path, h1:html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1], hasCanonical:html.includes('rel="canonical"'), sourceAssets:html.includes('/src/assets/') }));
  }
} finally { await server.close(); }
