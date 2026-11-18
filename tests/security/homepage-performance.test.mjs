import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

async function evaluate(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule((await fs.readFile(file, 'utf8')).replaceAll('import.meta.env.DEV','false').replaceAll('import.meta.env.SSR','true'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {}, URL });
  return exports;
}
const cloudinary = await evaluate('src/lib/cloudinary.ts');
const heroImage = await evaluate('src/lib/hero-image.ts', { './cloudinary': cloudinary });
const campaign = await evaluate('src/lib/homepage-campaign.ts', { './cloudinary': cloudinary });
const slideshow = await evaluate('src/lib/homepage-slides.ts', { './homepage-campaign': campaign });
const url = 'https://res.cloudinary.com/rllwk4bi/image/upload/v1/tuxar/website/banner/hero.webp';

test('homepage preload matches the hero responsive candidates and only one slide image renders initially', async () => {
  const i18n = { t: key => key, getLocalizedSlug: value => value };
  const modules = {
    react: React, 'react/jsx-runtime': jsx,
    'lucide-react': { ArrowRight: () => null },
    '@tanstack/react-router': { Link: ({ to, children, ...props }) => jsx.jsx('a', { ...props, href: to, children }), createFileRoute: () => options => options },
    '@/assets': { getProductAsset: () => url }, '@/i18n/i18n': i18n,
    '@/lib/cloudinary': cloudinary, '@/lib/hero-image': heroImage,
    '@/lib/homepage-campaign': { homepageBannerFromRow:()=>null },
    '@/lib/homepage-slides': slideshow,
    '@/lib/seo': { absoluteUrl: value => value, localizedAlternates: () => [] },
  };
  const rows=Array.from({length:5},(_,index)=>({id:'banner-'+index,locale:'en',enabled:true,archived:false,position:index,image_url:url,destination_url:'/en/shop',title:'Banner '+index,alt_text:'Campaign',button_label:'Shop',eyebrow:'',subtitle:'',show_text:true,tone:'light',image_width:1672,image_height:941,legacy_locale:'builtin:en:'+index}));
  const { HeroSlider } = await evaluate('src/components/site/HeroSlider.tsx', modules);
  const html = renderToStaticMarkup(React.createElement(HeroSlider, { locale: 'en',initialSlides:rows }));
  const { Route } = await evaluate('src/routes/$locale.index.tsx', modules);
  const preload = Route.head({ params: { locale: 'en' },loaderData:{banners:rows} }).links.find(link => link.rel === 'preload');
  assert.equal(preload.imageSrcSet, heroImage.heroImageSources(url));
  assert.equal(preload.imageSizes, '100vw');
  assert.ok(html.includes(`srcSet="${preload.imageSrcSet}"`));
  assert.ok(html.includes(`src="${preload.href}"`));
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert.equal((html.match(/<button[^>]*h-11 w-11/g) ?? []).length, 5);
  const empty=renderToStaticMarkup(React.createElement(HeroSlider,{locale:'en',initialSlides:[]}));
  assert.equal(empty,'','No published banners must produce no fallback carousel');
  const emptyHead=Route.head({params:{locale:'en'},loaderData:{banners:[]}});
  assert.ok(!emptyHead.links.some(link=>link.rel==='preload'),'Deleted/draft banner images must not be preloaded into a new page');
  const vite=await fs.readFile('vite.config.ts','utf8');
  assert.ok(!vite.includes('homepage-hero-discovery'),'The old fixed-image preload must not bypass publication state');
});

test('inlined consent still defaults every analytics and advertising permission to denied before the app', async () => {
  const html = await fs.readFile('index.html', 'utf8');
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const window = {};
  vm.runInNewContext(bootstrap, { window });
  const event = Array.from(window.dataLayer[0]);
  assert.deepEqual(event.slice(0, 2), ['consent', 'default']);
  for (const field of ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(event[2][field], 'denied');
  assert.ok(html.indexOf(bootstrap) < html.indexOf('src="/src/main.tsx"'));
  assert.doesNotMatch(html, /src="\/consent-default.js"/);
});
