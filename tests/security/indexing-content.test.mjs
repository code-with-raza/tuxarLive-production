import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Root,Item,Header,Trigger,Content} from '@radix-ui/react-accordion';

test('product description is mounted without crawler interaction and remains collapsible',async()=>{
 const source=await fs.readFile('src/routes/$locale.product.$slug.tsx','utf8');
 assert.match(source,/<Accordion type="multiple" defaultValue=\{\["desc"\]\}/);
 assert.match(source,/<AccordionItem value="desc">[\s\S]*?<AccordionContent[^>]*>\s*\{p\.description\}/);
 const description='An actual product description available before any click.';
 const html=renderToStaticMarkup(React.createElement(Root,{type:'multiple',defaultValue:['desc']},
  React.createElement(Item,{value:'desc'},React.createElement(Header,null,React.createElement(Trigger,null,'Description')),React.createElement(Content,null,description))));
 assert.ok(html.includes(description));
 assert.match(html,/aria-expanded="true"/);
});

test('approved production products use their saved English SEO fields without overriding localized copy',async()=>{
 const source=await fs.readFile('src/routes/$locale.product.$slug.tsx','utf8');
 const functions=source.slice(source.indexOf('function productSeoTitle('),source.indexOf('export const Route'));
 const code=ts.transpileModule(functions+'\nexports.title=productSeoTitle;exports.description=productSeoDescription;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,getLocalCatalogueProduct:()=>undefined});
 const products=JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json','utf8')).products;
 for(const product of products){assert.equal(exports.title(product,'en'),product.seoTitle);assert.equal(exports.description(product,'en'),product.seoDescription);}
 const localized={...products[0],name:'Nom localisé',description:'Description locale'};
 assert.equal(exports.title(localized,'fr'),'Nom localisé — Tuxar');
 assert.equal(exports.description(localized,'fr'),'Description locale');
});

test('only published populated collections are in the localized sitemap',async()=>{
 const sitemap=await fs.readFile('public/sitemap.xml','utf8');
 const generator=await fs.readFile('scripts/generate-sitemap.mjs','utf8');
 const route=await fs.readFile('src/routes/$locale.collections.$slug.tsx','utf8');
 assert.match(route,/const comingSoon = products\.length === 0/);
 assert.match(route,/if \(comingSoon\)[\s\S]*?name: "robots", content: "noindex, nofollow"/);
 assert.match(generator,/if \(!publishedCollectionSlugs\.has\(slug\)\) activeCollections\.delete\(slug\)/);
 assert.doesNotMatch(generator,/local-jackets\.json/);
 const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
 const approved=JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json','utf8')).products;
 assert.equal(approved.length,125);
 assert.ok(urls.length>=245+approved.length*5);
 assert.equal(new Set(urls).size,urls.length);
 for(const locale of ['en','it','de','fr','es']){
  const dictionary=JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'));
  for(const product of approved)assert.ok(urls.includes(`https://tuxar.co.uk/${locale}/product/${dictionary.products?.[product.slug]?.slug??product.slug}`));
 }
 assert.ok(urls.includes('https://tuxar.co.uk/en/collections/biker-jackets'));
 // Do not remove the underlying Biker collection/translation routes.
 assert.match(await fs.readFile('src/data/product-types.ts','utf8'),/slug: "biker-jackets"/);
 for(const locale of ['en','it','de','fr','es'])assert.equal(urls.filter(url=>new URL(url).pathname.split('/')[1]===locale).length,urls.length/5);
 for(const group of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)){
  const alternates=[...group[1].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
  assert.equal(alternates.length,6);
  for(const alternate of alternates)assert.ok(urls.includes(alternate[2]),alternate[2]);
 }
});

test('the existing racing product belongs to its collection and has a persistent localized discovery link',async()=>{
 const source=await fs.readFile('src/data/products/jackets.ts','utf8');
 const racing=source.slice(source.indexOf('slug: "white-racing-patch-jacket"'));
 assert.match(racing,/collections: \["cafe-racer-jackets", "motorcycle-jackets", "racing-jackets"\]/);
 const footer=await fs.readFile('src/components/site/Footer.tsx','utf8');
 assert.match(footer,/getLocalizedSlug\("racing-jackets", "collection", activeLocale\)/);
 const card=await fs.readFile('src/components/site/ProductCard.tsx','utf8');
 assert.match(card,/<Link\s+\{\.\.\.getLocalizedLink\("\/product\/\$slug", locale/);
});
