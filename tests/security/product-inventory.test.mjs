import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as inventory from '../../src/lib/product-inventory.ts';
import {basketQuantity, initialInventorySelection, inventoryOffers, stockForSelection, validatedInventory} from '../../src/lib/product-inventory.ts';

const rows=[
  {size:'M',color:'Black',color_hex:'#000000',stock:3,active:true},
  {size:'L',color:'Black',color_hex:'#000000',stock:0,active:true},
  {size:'M',color:'Brown',color_hex:'#663300',stock:7,active:true},
  {size:'XL',color:'Black',color_hex:'#000000',stock:20,active:false},
];
test('stock follows the exact active size and colour, including unavailable selections',()=>{
  assert.equal(stockForSelection(rows,'M','Black'),3);
  assert.equal(stockForSelection(rows,'L','Black'),0);
  assert.equal(stockForSelection(rows,'M','Brown'),7);
  assert.equal(stockForSelection(rows,'XL','Black'),0);
  assert.equal(stockForSelection(rows,'missing','Black'),0);
});
test('deep links select their own offer even when unavailable; default chooses available stock',()=>{
  assert.equal(initialInventorySelection(rows)?.size,'M');
  assert.equal(initialInventorySelection(rows,'L','Black')?.stock,0);
  assert.equal(initialInventorySelection(rows,'M','Brown')?.color,'Brown');
  assert.equal(initialInventorySelection([]),undefined);
});
test('unknown, failed and malformed inventory is rejected rather than changed to zero',()=>{
  for(const bad of [undefined,null,[{...rows[0],stock:-1}],[{...rows[0],stock:NaN}],[{...rows[0],stock:'3'}]]) {
    assert.throws(()=>validatedInventory(bad),/Availability could not be checked/);
    assert.throws(()=>basketQuantity(bad,'M','Black',1),/Availability could not be checked/);
  }
  assert.deepEqual(validatedInventory([]),[]);
});
test('basket quantities cannot exceed the newly checked selected variant stock',()=>{
  assert.equal(basketQuantity(rows,'M','Black',8),3);
  assert.equal(basketQuantity(rows,'L','Black',1),0);
  assert.equal(basketQuantity(rows,'M','Brown',5),5);
  assert.throws(()=>basketQuantity(rows,'M','Black',0),/valid quantity/);
  assert.throws(()=>basketQuantity(rows,'M','Black',1.5),/valid quantity/);
});
test('each structured offer reports its own stock and deep links to that size and colour',()=>{
  const offers=inventoryOffers(rows,127,'GBP','https://tuxar.co.uk/en/product/test');
  assert.equal(offers.length,3);
  assert.deepEqual(offers.map(o=>o.availability),['https://schema.org/InStock','https://schema.org/OutOfStock','https://schema.org/InStock']);
  for(let i=0;i<offers.length;i++) {
    const url=new URL(offers[i].url);
    assert.equal(url.searchParams.get('size'),rows[i].size);
    assert.equal(url.searchParams.get('color'),rows[i].color);
    assert.equal(offers[i].price,127);
    assert.equal(offers[i].priceCurrency,'GBP');
  }
});

test('variant price overrides describe the actual offer without changing another size',()=>{
 const priced=[{...rows[0],price_pence:15000},{...rows[1],price_pence:17500},rows[2]];
 assert.deepEqual(inventoryOffers(priced,127,'GBP','https://tuxar.co.uk/en/product/test').map(row=>row.price),[150,175,127]);
 assert.throws(()=>validatedInventory([{...rows[0],price_pence:-1}]));
});

test('real product route emits no frozen stock claims in initial HTML and live offers use variant stock',async()=>{
  const source=await fs.readFile('src/routes/$locale.product.$slug.tsx','utf8');
  const product={slug:'test',name:'Test product',category:'leather-bags',priceGBP:127,image:'/test.webp',gallery:['/test.webp'],description:'Product description',colors:[{name:'Black'}],inventory:rows,inStock:true};
  function schema(ssr,post=product) {
    const exports={};
    const modules={
      '@tanstack/react-router':{createFileRoute:()=>config=>config},
      '@/lib/product-inventory':inventory,
      '@/lib/market':{localeCurrency:()=> 'GBP'},
      '@/lib/local-catalogue':{getLocalCatalogueProduct:()=>undefined},
      '@/lib/seo':{absoluteUrl:path=>new URL(path,'https://tuxar.co.uk').href,localizedAlternates:()=>[]},
      '@/i18n/i18n':{getLocalizedSlug:slug=>slug,t:()=> 'Label'},
    };
    vm.runInNewContext(ts.transpileModule(source.replaceAll('import.meta.env.SSR',String(ssr)),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},URL});
    const head=exports.Route.head({loaderData:{product:post},params:{locale:'en',slug:'test'}});
    return head.scripts.map(script=>JSON.parse(script.children)).find(data=>data['@type']==='Product');
  }
  assert.equal(schema(true).offers.availability,undefined);
  assert.equal(schema(true).offers.price,127);
  assert.equal(schema(false).offers[1].availability,'https://schema.org/OutOfStock');
  assert.equal(schema(false).offers[0].availability,'https://schema.org/InStock');
  assert.equal(schema(false,{...product,inventory:undefined}).offers.availability,undefined);
});

test('product loader reads only the requested product and preserves prices when inventory fails',async()=>{
  const source=await fs.readFile('src/routes/$locale.product.$slug.tsx','utf8');
  const product={slug:'test',name:'Test product',priceGBP:127,inStock:true};
  let answer={data:{product_variants:rows},error:null};
  const filters=[];
  const query={select(){return query},eq(...args){filters.push(args);return query},abortSignal(){return query},async maybeSingle(){return answer}};
  const modules={
    '@tanstack/react-router':{createFileRoute:()=>config=>config},
    '@/lib/product-inventory':inventory,
    '@/lib/storefront-products':{getStorefrontProducts:async()=>[product]},
    '@/lib/supabase':{isSupabaseConfigured:()=>true,publicSupabase:{from:()=>query}},
    '@/lib/local-catalogue':{getLocalCatalogueProduct:()=>undefined},
    '@/lib/related-products':{relatedProducts:()=>[]},
    '@/i18n/i18n':{resolveSlug:slug=>slug,getLocalizedProduct:p=>({...p})},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(source.replaceAll('import.meta.env.SSR','false'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},AbortSignal});
  const load=()=>exports.Route.loader({params:{locale:'en',slug:'test'}});
  let loaded=await load();
  assert.equal(loaded.product.inventory.length,3);
  assert.equal(loaded.product.priceGBP,127);
  assert.ok(filters.some(([key,value])=>key==='slug'&&value==='test'));
  answer={data:{product_variants:[{...rows[0],stock:0}]},error:null};
  loaded=await load();assert.equal(loaded.product.inStock,false);
  answer={data:null,error:new Error('network failed')};
  loaded=await load();
  assert.equal(loaded.inventoryError,true);
  assert.equal(loaded.product.inventory,undefined);
  assert.equal(loaded.product.priceGBP,127);
});
