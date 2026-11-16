import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as policies from '../../src/data/returns-policy.ts';

async function evaluate(file,modules){
 const exports={};const code=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]}});return exports;
}
const locales=['en','de','es','fr','it'];
test('all five rendered policies contain the approved return terms and exact address, with localized self-canonicals and reciprocal alternates',async()=>{
 let locale='en';
 const modules={
  'react/jsx-runtime':jsxRuntime,
  '@/data/returns-policy':policies,
  '@/components/site/PageHero':{PageHero:({title})=>React.createElement('h1',null,title)},
  '@/i18n/i18n':{t:()=> 'Home'},
  '@/lib/seo':{absoluteUrl:path=>'https://tuxar.co.uk'+path,localizedAlternates:fn=>[...locales.map(lang=>({rel:'alternate',hrefLang:lang,href:'https://tuxar.co.uk'+fn(lang)})),{rel:'alternate',hrefLang:'x-default',href:'https://tuxar.co.uk'+fn('en')}]},
  '@tanstack/react-router':{createFileRoute:()=>options=>({...options,useParams:()=>({locale})})},
 };
 modules['@/components/site/BusinessAddress']=await evaluate('src/components/site/BusinessAddress.tsx',modules);
 const {Route}=await evaluate('src/routes/$locale.returns-policy.tsx',modules);
 const heads=new Map();
 for(locale of locales){
  const p=policies.RETURN_POLICIES[locale];
  const html=renderToStaticMarkup(React.createElement(Route.component));
  const plain=html.replace(/<[^>]+>/g,'').replaceAll('&#x27;',"'").replaceAll('&amp;','&');
  assert.equal((html.match(/<h1/g)||[]).length,1);
  for(const value of [p.title,p.eligibility,p.tracked,p.fees,p.refund,p.custom,p.rights,...policies.BUSINESS_ADDRESS])assert.ok(plain.includes(value),`${locale}: ${value}`);
  assert.ok(p.start.includes('15'));assert.ok(p.refund.includes('10'));assert.ok(p.rights.includes('14'));assert.equal((html.match(/<h2/g)||[]).length,8);assert.ok(html.includes('mailto:tuxar.co@gmail.com'));
  assert.match(html,/<address[^>]*>.*Tuxar.*<br\/>Via Pollenzo 58\/D.*<br\/>10141 Torino TO.*<br\/>Italy/s);
  assert.ok(plain.includes(p.start));assert.ok(plain.includes(p.faulty));
  const head=Route.head({params:{locale}});heads.set(locale,head);
  assert.equal(head.meta.find(item=>item.name==='description').content,p.description);
  assert.equal(head.meta.find(item=>item.title).title,p.title+' — Tuxar');
  assert.equal(head.links.find(item=>item.rel==='canonical').href,`https://tuxar.co.uk/${locale}/returns-policy`);
  assert.equal(head.links.filter(item=>item.rel==='alternate').length,6);
  assert.ok(!/30|free tracked return|retours gratuits|resi gratuiti|kostenlose Rückgabe|devoluciones gratuitas/i.test(policies.returnPolicySummary(locale)));
 }
 for(const [language,head] of heads)for(const target of locales){
  assert.equal(head.links.find(item=>item.hrefLang===target).href,`https://tuxar.co.uk/${target}/returns-policy`);
  assert.equal(heads.get(target).links.find(item=>item.hrefLang===language).href,`https://tuxar.co.uk/${language}/returns-policy`);
 }
 assert.match(await fs.readFile('src/routes/$locale.tsx','utf8'),/document\.documentElement\.lang = locale/);
 assert.match(await fs.readFile('scripts/prerender-public-pages.mjs','utf8'),/<html lang=\\?"\$\{locale\}/);
});
