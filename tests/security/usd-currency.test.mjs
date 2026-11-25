import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as money from '../../supabase/functions/_shared/usd-money.ts';
import * as quotes from '../../supabase/functions/_shared/usd-quote.ts';
import {HttpError} from '../../supabase/functions/_shared/http.ts';

const rate=()=>({version:1,rateE8:130713333,date:new Date().toISOString().slice(0,10),expiresAt:Date.now()+3600000});
test('conversion uses precise rates and integer cents, not the rounded headline rate',()=>{
 assert.equal(money.usdMinor(15000,rate().rateE8),19607);
 assert.equal(money.usdMinor(1001,rate().rateE8)*3,3924);
 assert.equal(money.usdMinor(3003,rate().rateE8),3925);
 assert.throws(()=>money.usdMinor(-1,rate().rateE8));
 assert.throws(()=>money.usdMinor(2**53,rate().rateE8));
});

test('USD quote signatures reject altered rates, foreign keys and genuine expired quotes',async()=>{
 const signed=await quotes.signUsdQuote(rate(),'fixture-quote-key');
 assert.equal((await quotes.verifyUsdQuote(signed.token,'fixture-quote-key')).rateE8,signed.rateE8);
 const [body,signature]=signed.token.split('.');
 const altered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url')),rateE8:100000000})).toString('base64url');
 await assert.rejects(quotes.verifyUsdQuote(altered+'.'+signature,'fixture-quote-key'));
 await assert.rejects(quotes.verifyUsdQuote(signed.token,'different-fixture-key'));
 await assert.rejects(quotes.verifyUsdQuote(signed.token,'fixture-quote-key',signed.expiresAt+1));
 assert.equal(money.validUsdRate({...rate(),date:'2000-01-01'}),false);
});

async function market({fails=false}={}) {
 const exports={},jar=new Map(),session=new Map();let calls=0;
 const signed=await quotes.signUsdQuote(rate(),'fixture-quote-key');
 const document={get cookie(){return [...jar].map(([k,v])=>`${k}=${v}`).join('; ')},set cookie(value){const[k,v]=value.split(';')[0].split('=');jar.set(k,v)}};
 const source=ts.transpileModule(await fs.readFile('src/lib/market.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const publicSupabase={functions:{invoke:async(name,options)=>{calls++;assert.equal(name,'usd-rate');assert.deepEqual(JSON.parse(JSON.stringify(options.body)),{});return fails?{data:null,error:new Error('offline')}:{data:signed,error:null}}}};
 vm.runInNewContext(source,{exports,document,window:{sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)}},location:{protocol:'https:'},setTimeout:()=>1,clearTimeout(){},require:name=>name.includes('usd-money')?money:name.includes('supabase')?{publicSupabase}:{useSyncExternalStore:(subscribe,snapshot)=>{subscribe(()=>{});return snapshot()}}});
 return {...exports,get calls(){return calls}};
}
test('USD display, line quantities and bag totals use the same cents, while GBP/EUR are unchanged',async()=>{
 const api=await market();
 assert.equal(api.useMarketCurrency('en').formatMoney(150),'£150');
 api.setCurrency('EUR');assert.equal(api.useMarketCurrency('en').formatMoney(150),'€150');
 assert.equal(api.calls,0);
 api.setCurrency('USD');let usd=api.useMarketCurrency('en');assert.equal(usd.currencyReady,false);assert.equal(usd.formatMoney(150),'—');
 await api.refreshUsdPricing();usd=api.useMarketCurrency('en');assert.equal(api.calls,1);
 assert.equal(usd.formatMoney(150),'$196.07');assert.equal(usd.formatLineMoney(10.01,3),'$39.24');
 assert.equal(usd.formatCartTotal([{priceGBP:10.01,qty:3}]),'$39.24');
 assert.equal(usd.formatSaving(1,0.01),'$1.30');assert.equal(usd.currency,'USD');
 api.setCurrency('GBP');assert.equal(api.useMarketCurrency('en').formatMoney(150),'£150');
});
test('rate lookup failure shows no invented dollar price and cannot become payment-ready',async()=>{
 const api=await market({fails:true});api.setCurrency('USD');api.useMarketCurrency('en');await api.refreshUsdPricing();
 const usd=api.useMarketCurrency('en');assert.equal(usd.currencyReady,false);assert.equal(usd.formatMoney(150),'—');assert.ok(usd.usdRateError);
});

test('bag price refresh updates only the selected size and colour',async()=>{
 const source=ts.transpileModule(await fs.readFile('src/store/shop.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let state;const exports={};
 const set=update=>{state={...state,...(typeof update==='function'?update(state):update)}};
 vm.runInNewContext(source,{exports,require:name=>name==='zustand'?{create:()=>initializer=>{state=initializer(set,()=>state);return {getState:()=>state}}}:{persist:initializer=>initializer}});
 const line={slug:'jacket',name:'Jacket',image:'/test.webp',color:'Black',qty:1};
 state.addToCart({...line,size:'M',priceGBP:150});state.addToCart({...line,size:'L',priceGBP:175});
 state.updatePrice('jacket',151,200,{size:'M',color:'Black'});
 assert.deepEqual(JSON.parse(JSON.stringify(state.cart.map(row=>[row.size,row.priceGBP]))),[['M',151],['L',175]]);
});

test('rate endpoint caches a valid reference rate and fails closed on invalid or unavailable upstream data',async()=>{
 const source=ts.transpileModule(await fs.readFile('supabase/functions/usd-rate/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const bad of [false,true]){
  let handler,calls=0;
  vm.runInNewContext(source,{exports:{},require:name=>name.includes('usd-quote')?quotes:name.includes('usd-money')?money:{HttpError,secureServe:(_name,policy,fn)=>{assert.equal(policy.auth,'public');handler=fn}},Deno:{env:{get:()=> 'fixture-quote-key'}},Response,AbortSignal,fetch:async url=>{calls++;assert.equal(url,'https://api.frankfurter.dev/v2/rate/gbp/usd');return bad?new Response('',{status:503}):Response.json({base:'GBP',quote:'USD',rate:1.30713333,date:rate().date})}});
  if(bad){await assert.rejects(handler());continue}
  const first=await(await handler()).json();await handler();assert.equal(calls,1);assert.equal((await quotes.verifyUsdQuote(first.token,'fixture-quote-key')).rateE8,130713333);
 }
});

test('USD schema and coupons preserve old orders, GBP thresholds, fixed discounts and execution permissions',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table public.coupons(id uuid primary key,code text,status text,starts_at timestamptz,expires_at timestamptz,usage_limit integer,usage_count integer default 0,minimum_order_pence integer default 0,maximum_discount_pence integer,discount_type text,discount_value integer,updated_at timestamptz);
   create table public.orders(id uuid primary key,user_id uuid,currency text not null default 'GBP' constraint orders_currency_check check(currency in ('GBP','EUR')),subtotal_pence integer,shipping_pence integer default 0,total_pence integer,coupon_id uuid,coupon_code text,discount_pence integer default 0,updated_at timestamptz);
   insert into public.orders(id,currency,subtotal_pence,total_pence) values('00000000-0000-0000-0000-000000000001','GBP',15000,15000),('00000000-0000-0000-0000-000000000002','EUR',15000,15000);
  `);
  await db.exec(await fs.readFile('supabase/migrations/202611250001_usd_checkout.sql','utf8'));
  await assert.rejects(db.exec("insert into public.orders(id,currency) values('00000000-0000-0000-0000-000000000003','USD')"));
  await db.exec(`insert into public.coupons(id,code,status,minimum_order_pence,discount_type,discount_value) values
   ('10000000-0000-0000-0000-000000000001','TEN','active',15000,'percentage',10),
   ('10000000-0000-0000-0000-000000000002','FIXED','active',0,'fixed',2000),
   ('10000000-0000-0000-0000-000000000003','MINIMUM','active',20000,'percentage',10);
   insert into public.orders(id,user_id,currency,subtotal_pence,total_pence,usd_rate_e8,usd_rate_date,base_subtotal_pence) values('00000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','USD',19607,19607,130713333,current_date,15000);
   select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);`);
  const preview=async(code,base=15000,subtotal=19607)=>(await db.query('select public.preview_usd_coupon($1,$2,$3,$4) as value',[code,base,subtotal,130713333])).rows[0].value;
  assert.equal((await preview('TEN')).discountPence,1960);
  assert.equal((await preview('FIXED')).discountPence,2614);
  await assert.rejects(preview('MINIMUM'));
  await db.exec("update public.coupons set maximum_discount_pence=1000 where code='FIXED'");
  assert.equal((await preview('FIXED')).discountPence,1307);
  const redeemed=(await db.query("select public.redeem_order_coupon_internal('00000000-0000-0000-0000-000000000003','TEN') as value")).rows[0].value;
  assert.equal(redeemed.totalPence,17647);
  assert.deepEqual((await db.query("select currency,total_pence from public.orders where currency<>'USD' order by id")).rows,[{currency:'GBP',total_pence:15000},{currency:'EUR',total_pence:15000}]);
  assert.equal((await db.query("select has_function_privilege('anon','public.preview_usd_coupon(text,integer,integer,bigint)','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.redeem_order_coupon_internal(uuid,text)','EXECUTE') as allowed")).rows[0].allowed,false);
 } finally {await db.close()}
});
