import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as delivery from '../../supabase/functions/_shared/delivery.ts';
import * as currencyHelpers from '../../supabase/functions/_shared/currency.ts';

const source = ts.transpileModule(await fs.readFile('supabase/functions/create-checkout-session/index.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(method, country='Germany', currency) {
  let handler, order, stripe;
  const calls=[];
  const fetch=async(url,options={})=>{
    calls.push(url);
    if(url.includes('/rest/v1/products?')) return Response.json([{name:'Jacket',price_pence:19900,product_variants:[{sku:'TEST-M',stock:15,active:true,price_pence:null}]}]);
    if(url.includes('/customer_profiles?'))return Response.json([{user_id:'customer'}]);
    if(url.endsWith('/rest/v1/orders')) {order=JSON.parse(options.body);return Response.json([{id:'order-1'}]);}
    if(url.endsWith('/rest/v1/order_items'))return new Response(null,{status:201});
    if(url==='https://api.stripe.com/v1/checkout/sessions'){stripe=options.body;return Response.json({id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fixture'});}
    if(url.includes('/rest/v1/orders?id='))return new Response(null,{status:204});
    throw Error('Unexpected outbound URL: '+url);
  };
  vm.runInNewContext(source,{exports:{},require:name=>name.includes('delivery')?delivery:name.includes('currency')?currencyHelpers:{secureServe:(_name,_policy,fn)=>{handler=fn;}},Deno:{env:{get:()=> 'fixture-not-a-secret'}},Response,URLSearchParams,crypto,fetch});
  const response=await handler({method:'POST',json:async()=>({currency,locale:'en',items:[{slug:'jacket',size:'M',color:'Black',qty:1}],customer:{customerName:'Customer Test',customerPhone:'12345678',streetAddress:'1 Test Street',city:'Berlin',postalCode:'10115',country,shippingMethod:method}})},{user:{id:'customer',email:'test@example.com'}});
  return {response,order,stripe,calls};
}
test('every carrier is free in all five markets, retains its choice and gets its own working-day window',async()=>{
  for(const country of delivery.DELIVERY_COUNTRIES) for(const option of delivery.DELIVERY_OPTIONS){
    const result=await run(option.id,country.name);
    assert.equal(result.response.status,200);
    assert.equal(result.order.courier,option.name);
    assert.equal(result.order.shipping_method,'STANDARD'); // existing database constraint, not carrier identity
    assert.equal(result.order.shipping_pence,0);
    assert.equal(result.order.total_pence,19900);
    assert.equal(result.order.currency,country.code==='GB'?'GBP':'EUR');
    assert.equal(result.stripe.get('line_items[0][price_data][currency]'),country.code==='GB'?'gbp':'eur');
    assert.equal(result.order.estimated_delivery_to,delivery.estimatedDeliveryWindow(new Date(),option.maxDays).to);
    assert.equal(result.stripe.get('metadata[delivery_carrier]'),option.name);
    assert.deepEqual(delivery.DELIVERY_COUNTRIES.map((_,index)=>result.stripe.get(`shipping_address_collection[allowed_countries][${index}]`)),['GB','DE','ES','FR','IT']);
    assert.equal(result.stripe.has('line_items[1][price_data][unit_amount]'),false);
  }
});
test('unknown carriers and unsupported destinations fail before database writes or Stripe requests',async()=>{
  for(const [method,country] of [['INVALID','Germany'],['UPS','United States']]){
    const result=await run(method,country);
    assert.equal(result.response.status,400); assert.equal(result.calls.length,0);
  }
});
test('cached Standard/Express clients remain accepted with zero server delivery charge',async()=>{
  for(const [method,name] of [['STANDARD','UPS'],['EXPRESS','DPD Geopost']]){
    const result=await run(method);
    assert.equal(result.response.status,200);assert.equal(result.order.courier,name);assert.equal(result.order.shipping_pence,0);
  }
});

test('manual GBP/EUR choice is saved and charged as the same numeric price; unsupported currencies never create an order',async()=>{
  for(const currency of ['GBP','EUR']){
    const result=await run('UPS','Italy',currency);
    assert.equal(result.response.status,200);assert.equal(result.order.currency,currency);
    assert.equal(result.order.total_pence,19900);assert.equal(result.stripe.get('line_items[0][price_data][unit_amount]'),'19900');
    assert.equal(result.stripe.get('adaptive_pricing[enabled]'),'false');
    assert.equal(result.stripe.get('line_items[0][price_data][currency]'),currency.toLowerCase());
  }
  const invalid=await run('UPS','Italy','USD');assert.equal(invalid.response.status,400);assert.equal(invalid.calls.length,0);
});
