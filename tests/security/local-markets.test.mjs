import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import { currencyForCountry, paymentMatches } from '../../supabase/functions/_shared/currency.ts';
import { formatOrderTotals } from '../../src/lib/order-money.ts';
import { PGlite } from '@electric-sql/pglite';

test('currency migration preserves historical GBP rows and permits EUR without permitting other currencies',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create table public.orders(id int, total_pence int, currency text not null default 'GBP' check(currency='GBP')); insert into public.orders(id,total_pence) values(1,19900)");
  await db.exec(await fs.readFile('supabase/migrations/202610310001_gbp_eur_orders.sql','utf8'));
  await db.exec("insert into public.orders values(2,19900,'EUR')");
  assert.deepEqual((await db.query('select currency,total_pence from public.orders order by id')).rows,[{currency:'GBP',total_pence:19900},{currency:'EUR',total_pence:19900}]);
  await assert.rejects(db.exec("insert into public.orders values(3,19900,'USD')"));
 }finally{await db.close();}
});

test('same numeric prices have distinct GBP/EUR charges and cannot be verified in the wrong currency',()=>{
  for(const [country,currency] of [['United Kingdom','GBP'],['Italy','EUR'],['Germany','EUR'],['France','EUR'],['Spain','EUR']]){
    assert.equal(currencyForCountry(country),currency);
    const order={currency,total_pence:19900};
    assert.ok(paymentMatches(order,{currency:currency.toLowerCase(),amount_total:19900,payment_status:'paid'}));
    assert.equal(paymentMatches(order,{currency:currency==='GBP'?'eur':'gbp',amount_total:19900,payment_status:'paid'}),false);
    assert.equal(paymentMatches(order,{currency:currency.toLowerCase(),amount_total:19800,payment_status:'paid'}),false);
  }
  assert.equal(paymentMatches({currency:'USD',total_pence:100},{currency:'usd',amount_total:100,payment_status:'paid'}),false);
  assert.equal(formatOrderTotals([{total_pence:19900,currency:'GBP'},{total_pence:19900,currency:'EUR'}]),'£199.00 + €199.00');
});

test('storefront formatting responds to a manual currency choice independently of language',async()=>{
 const exports={};const jar=new Map();let updates=0;
 const document={get cookie(){return [...jar].map(([key,value])=>`${key}=${value}`).join('; ')},set cookie(value){const [key,content]=value.split(';')[0].split('=');jar.set(key,content)}};
 const code=ts.transpileModule(await fs.readFile('src/lib/market.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,document,location:{protocol:'https:'},require:()=>({useSyncExternalStore:(subscribe,snapshot)=>{subscribe(()=>updates++);return snapshot();}})});
 assert.equal(exports.useMarketCurrency('en').formatMoney(199),'£199');
 assert.equal(exports.useMarketCurrency('it').currency,'EUR');
 exports.setCurrency('EUR');assert.ok(updates>0);
 assert.equal(exports.useMarketCurrency('en').formatMoney(199),'€199');
 exports.setCurrency('GBP');assert.equal(exports.useMarketCurrency('it').currency,'GBP');
 assert.equal(jar.get('tuxar-currency-manual'),'1');
});

async function geography(country,{path='/en/product/old-jacket',cookie='',search='?utm_source=test',fails=false}={}){
 const source=ts.transpileModule(await fs.readFile('src/i18n/automatic-market.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const output={requests:0,redirects:[],currencies:[]};const session=new Map();const exports={};
 const cookies=new Map(cookie.split(';').filter(Boolean).map(value=>value.trim().split('=')));
 const document={get cookie(){return [...cookies].map(([key,value])=>`${key}=${value}`).join('; ')},set cookie(value){const [key,content]=value.split(';')[0].split('=');cookies.set(key,content)}};
 vm.runInNewContext(source,{exports,URLSearchParams,AbortSignal,navigator:{userAgent:'Browser'},document,location:{pathname:path,search,hash:'#details',protocol:'https:',replace:url=>output.redirects.push(url)},sessionStorage:{getItem:key=>session.get(key),setItem:(key,value)=>session.set(key,value)},fetch:async()=>{output.requests++;if(fails)throw Error('offline');return {ok:true,json:async()=>({country})}},require:name=>name.includes('market')?{setCurrency:(...args)=>output.currencies.push(args)}:{resolveSlug:()=> 'jacket',getLocalizedSlug:(_slug,_kind,locale)=>`${locale}-jacket`}});
 await exports.initializeAutomaticMarket();await exports.initializeAutomaticMarket();return output;
}
test('country detection selects each native locale and currency once, preserving campaign parameters',async()=>{
 for(const [country,locale,currency] of [['GB','en','GBP'],['IT','it','EUR'],['DE','de','EUR'],['FR','fr','EUR'],['ES','es','EUR']]){
  const result=await geography(country);assert.equal(result.requests,1);assert.deepEqual(result.currencies[0],[currency,false]);
  assert.equal(result.redirects[0],`/${locale}/product/${locale}-jacket?utm_source=test#details`);
 }
});
test('manual preferences, private/payment routes, OAuth callbacks and geolocation failure remain safe',async()=>{
 for(const path of ['/en/checkout','/en/admin/products/id','/it/account/orders','/fr/confirmation'])assert.equal((await geography('IT',{path})).requests,0);
 assert.equal((await geography('IT',{search:'?code=oauth'})).requests,0);
 assert.equal((await geography('IT',{cookie:'tuxar-language-manual=1; tuxar-currency-manual=1'})).requests,0);
 const language=await geography('IT',{cookie:'tuxar-language-manual=1'});assert.equal(language.redirects.length,0);assert.equal(language.currencies[0][0],'EUR');
 assert.equal((await geography('IT',{fails:true})).redirects.length,0);
 assert.equal((await geography('US')).redirects.length,0);
});
