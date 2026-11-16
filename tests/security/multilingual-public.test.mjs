import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { inspectPublicHtml } from '../../scripts/verify-public-locale-html.mjs';
const locales=['en','de','es','fr','it'];
const dictionaries=Object.fromEntries(await Promise.all(locales.map(async locale=>[locale,JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'))])));
const products=(await Promise.all(['approved-catalogue','approved-womens-catalogue'].map(async file=>JSON.parse(await fs.readFile(`src/data/products/${file}.json`,'utf8')).products))).flat();
for(const file of ['jackets','suits','bags','accessories']){
 const exports={};vm.runInNewContext(ts.transpileModule(await fs.readFile(`src/data/products/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({getProductAsset:value=>value})});
 products.push(...Object.values(exports).find(Array.isArray));
}
const i18n={};
vm.runInNewContext(ts.transpileModule(await fs.readFile('src/i18n/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:i18n,require:name=>name.startsWith('./locales/')?{default:dictionaries[name.split('/').at(-1).split('.')[0]]}:name.includes('preview')?{previewCollection:value=>value}:{}});

test('all 241 product pages have native copy in every European locale without changing stock/checkout identifiers',()=>{
 assert.equal(products.length,241);
 for(const locale of locales.slice(1))for(const product of products){
  const translated=i18n.getLocalizedProduct(product,locale);
  assert.notEqual(translated.name,product.name,`${locale}/${product.slug}: name`);
  assert.notEqual(translated.description,product.description,`${locale}/${product.slug}: description`);
  assert.equal(translated.slug,product.slug);
  assert.equal(translated.priceGBP,product.priceGBP);
  for(const field of ['sizes','colors','gallery'])assert.equal(translated[field],product[field]);
  for(const spec of translated.specs)assert.ok(spec.label&&spec.value);
  if(product.specs.some(spec=>spec.label==='Safety'))assert.match(translated.description,/CE\/UKCA/);
 }
});

test('localized product slugs round-trip in all locales and copied wrong-language slugs resolve to the same product',()=>{
 for(const locale of locales){
  const slugs=new Set();
  for(const product of products){
   const slug=i18n.getLocalizedSlug(product.slug,'product',locale);
   assert.ok(!slugs.has(slug),`${locale}/${slug}`);slugs.add(slug);
   assert.equal(i18n.resolveSlug(slug,'product',locale),product.slug);
   for(const other of locales)assert.equal(i18n.resolveSlug(slug,'product',other),product.slug);
  }
 }
 assert.equal(i18n.getLocalizedColor('Black / Red','fr'),'Noir / Rouge');
 assert.equal(i18n.getLocalizedOption('One Size','de'),'Einheitsgröße');
});

test('published sitemap groups have equal locale coverage, unique self URLs and reciprocal six-language alternates',async()=>{
 const xml=await fs.readFile('public/sitemap.xml','utf8');
 const groups=[...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([,body])=>({url:body.match(/<loc>([^<]+)<\/loc>/)[1],alts:Object.fromEntries([...body.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([,locale,url])=>[locale,url]))}));
 const byUrl=new Map(groups.map(group=>[group.url,group]));
 assert.equal(byUrl.size,groups.length);
 for(const locale of locales)assert.equal(groups.filter(group=>new URL(group.url).pathname.split('/')[1]===locale).length,groups.length/5);
 for(const group of groups){
  const locale=new URL(group.url).pathname.split('/')[1];
  assert.equal(Object.keys(group.alts).length,6);
  assert.equal(group.alts[locale],group.url);
  assert.equal(group.alts['x-default'],group.alts.en);
  for(const alternate of Object.values(group.alts))assert.equal(byUrl.get(alternate)?.alts[locale],group.url);
 }
 for(const locale of locales)assert.ok(byUrl.has(`https://tuxar.co.uk/${locale}/sales`));
 assert.ok(!byUrl.has('https://tuxar.co.uk/en/collections/best-sellers'),'empty men group must not be populated by women products');
 assert.ok(byUrl.has('https://tuxar.co.uk/en/collections/women-best-sellers'));
 const robots=await fs.readFile('public/robots.txt','utf8');
 assert.doesNotMatch(robots,/Disallow:\s*\/(?:en|de|es|fr|it)(?:\/|$)/m);
 assert.match(robots,/Disallow: \/wp-admin\//);
});

test('public HTML validator rejects non-self canonicals, wrong languages, noindex and broken hreflang',()=>{
 const url='https://tuxar.co.uk/fr/shop';
 const head=`<link rel="canonical" href="${url}">${[...locales,'x-default'].map(locale=>`<link rel="alternate" hrefLang="${locale}" href="https://tuxar.co.uk/${locale==='x-default'?'en':locale}/shop">`).join('')}`;
 const html=`<html lang="fr"><head><title>Boutique Tuxar</title><meta name="description" content="Découvrez nos modèles.">${head}</head><body><h1>Boutique</h1></body></html>`;
 assert.equal(inspectPublicHtml(html,url).locale,'fr');
 for(const bad of [html.replace('lang="fr"','lang="en"'),html.replace('rel="canonical"','rel="other"'),html.replace('</head>','<meta name="robots" content="noindex, follow"></head>'),html.replace('hrefLang="de"','hrefLang="en"'),html.replace('https://tuxar.co.uk/de/shop','https://tuxar.co.uk/en/shop')])assert.throws(()=>inspectPublicHtml(bad,url));
});
