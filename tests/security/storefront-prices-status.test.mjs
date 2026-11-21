import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import * as discounts from '../../src/lib/product-discount.ts';
const require = createRequire(import.meta.url);
const fixtures = JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json','utf8')).products.slice(0,3);
async function evaluate(file, modules, env={DEV:false,SSR:false}) {
 const source=(await fs.readFile(file,'utf8')).replaceAll('import.meta.env.DEV',String(env.DEV)).replaceAll('import.meta.env.SSR',String(env.SSR));
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,AbortSignal,require:name=>modules[name]??{},console});
 return exports;
}
async function catalogue() {
 let rows=[],error=null,calls=[];
 const query={select(value){calls.push(['select',value]);return this},eq(...args){calls.push(['eq',...args]);return this},order(){return this},range(from,to){this.from=from;this.to=to;calls.push(['range',from,to]);return this},async abortSignal(){return {data:rows.slice(this.from,this.to+1),error}}};
 const api=await evaluate('src/lib/storefront-products.ts',{'@/data/products':{PRODUCTS:fixtures},'@/lib/supabase':{isSupabaseConfigured:()=>true,publicSupabase:{from:()=>query},supabase:{from(){throw Error('Public prices must not use an authenticated client')}}}});
 return {api,calls,setRows(value){rows=value},setError(value){error=value}};
}
const row=(product,status='active',price=13899,previous=17014)=>({slug:product.slug,status,price_pence:price,compare_price_pence:previous});
test('public catalogue uses saved prices and hides draft, archived and missing records without changing names or structure',async()=>{
 const h=await catalogue();h.setRows([row(fixtures[0]),row(fixtures[1],'draft'),row(fixtures[2],'archived')]);
 const products=await h.api.getStorefrontProducts();assert.equal(products.length,1);
 assert.equal(products[0].priceGBP,138.99);assert.equal(products[0].comparePriceGBP,170.14);
 for(const key of ['slug','name','tagline','category','image','gallery','collections'])assert.deepEqual(products[0][key],fixtures[0][key]);
 assert.ok(h.calls.some(call=>call[0]==='eq'&&call[1]==='status'&&call[2]==='active'));
 h.setRows([row(fixtures[0],'archived')]);assert.equal((await h.api.getStorefrontProducts()).length,0);
 h.setRows([row(fixtures[0],'active',12500,null)]);const restored=await h.api.getStorefrontProducts();
 assert.equal(restored[0].priceGBP,125);assert.equal(restored[0].comparePriceGBP,undefined);
 h.setError({message:'offline'});await assert.rejects(h.api.getStorefrontProducts(),/could not be loaded/);
});
test('catalogue pages through the API row limit and rejects a production build with missing configuration',async()=>{
 const h=await catalogue();h.setRows(Array.from({length:501},(_,index)=>row({slug:'item-'+index})));
 await h.api.getStorefrontProducts();assert.equal(h.calls.filter(call=>call[0]==='range').length,2);
 const api=await evaluate('src/lib/storefront-products.ts',{'@/data/products':{PRODUCTS:fixtures},'@/lib/supabase':{isSupabaseConfigured:()=>false}});
 await assert.rejects(api.getStorefrontProducts(),/unavailable/);
});
test('Cloudinary galleries come from the database so admin edits survive later CI rebuilds',async()=>{
 const h=await catalogue();const front='https://res.cloudinary.com/test-cloud/image/upload/front.webp',back='https://res.cloudinary.com/test-cloud/image/upload/back.webp';
 h.setRows([{...row(fixtures[0]),product_images:[{url:back,position:1},{url:front,position:0},{url:front,position:2}]}]);
 const [product]=await h.api.getStorefrontProducts();assert.equal(product.image,front);assert.deepEqual(Array.from(product.gallery),[front,back]);
 const updated='https://res.cloudinary.com/test-cloud/image/upload/admin.webp';h.setRows([{...row(fixtures[0]),product_images:[{url:updated,position:0}]}]);
 assert.equal((await h.api.getStorefrontProducts())[0].image,updated);
 h.setRows([{...row(fixtures[0]),product_images:[]}]);assert.equal((await h.api.getStorefrontProducts())[0].image,fixtures[0].image);
});
test('discount amounts use pennies, whole percentages are conservative and non-discounts have no savings label',()=>{
 assert.deepEqual(discounts.productDiscount(138.99,170.14),{savings:31.15,percent:18});
 for(const previous of [undefined,null,0,100,138.99,NaN])assert.equal(discounts.productDiscount(138.99,previous),null);
 assert.equal(discounts.savingsLabel('en','£31.15',18),'Save £31.15 · 18% off');
});
test('actual card keeps its product name and shows the saved current price, previous price and savings once',async()=>{
 const {ProductCard}=await evaluate('src/components/site/ProductCard.tsx',{
  react:{useState:value=>[value,()=>{}]},'react/jsx-runtime':require('react/jsx-runtime'),
  '@tanstack/react-router':{useParams:()=>({locale:'en'}),Link:'a'},'lucide-react':{Heart:'span'},
  '@/store/shop':{useShop:selector=>selector({wishlist:[],toggleWish(){}})},
  '@/i18n/i18n':{getLocalizedProduct:p=>p,getLocalizedLink:()=>({href:'/product'})},
  '@/lib/market':{useMarketCurrency:()=>({currency:'GBP',formatMoney:n=>'£'+n.toFixed(2)})},
  '@/lib/cloudinary':{cloudinaryUrl:url=>url},'@/lib/product-discount':discounts,
 });
 const {renderToStaticMarkup}=require('react-dom/server');
 const html=renderToStaticMarkup(ProductCard({p:{...fixtures[0],priceGBP:138.99,comparePriceGBP:170.14}}));
 assert.ok(html.includes('£138.99'));assert.ok(html.includes('£170.14'));assert.ok(html.includes('Save £31.15 · 18% off'));
 assert.equal((html.match(/£170.14/g)??[]).length,1);
 const normal=renderToStaticMarkup(ProductCard({p:{...fixtures[0],priceGBP:138.99,comparePriceGBP:100}}));assert.ok(!normal.includes('line-through'));assert.ok(!normal.includes('Save '));
});
test('direct product routes reject unpublished products and their offers use current database prices',async()=>{
 let products=[{...fixtures[0],priceGBP:138.99}];
 const {Route}=await evaluate('src/routes/$locale.product.$slug.tsx',{
  '@tanstack/react-router':{createFileRoute:()=>options=>options,notFound:()=>new Error('Not found')},
  '@/lib/storefront-products':{getStorefrontProducts:async()=>products},
  '@/lib/related-products':{relatedProducts:()=>[]},
  '@/lib/market':{localeCurrency:()=> 'GBP'},
  '@/i18n/i18n':{t:key=>key,resolveSlug:slug=>slug,getLocalizedProduct:p=>p,getLocalizedSlug:slug=>slug},
  '@/lib/seo':{absoluteUrl:p=>'https://tuxar.co.uk'+p,localizedAlternates:()=>[]},
  '@/lib/local-catalogue':{getLocalCatalogueProduct:()=>undefined},
 });
 const args={params:{locale:'en',slug:fixtures[0].slug}};
 const data=await Route.loader(args);assert.equal(data.product.priceGBP,138.99);
 const head=Route.head({...args,loaderData:data});assert.ok(JSON.stringify(head.scripts).includes('138.99'));
 products=[];await assert.rejects(Route.loader(args),/Not found/);
});

test('saved bags refresh prices and remove unpublished products, while network errors keep the bag intact',async()=>{
 const items=[{...fixtures[0],slug:fixtures[0].slug,size:'M',color:'Black',qty:1,priceGBP:189}];
 let result={data:{price_pence:13899,compare_price_pence:17014,product_variants:[{stock:5}]},error:null};
 let states=[],cursor=0,effects=[],listeners={},updates=[];
 const store={cart:items,removeFromCart(slug){store.cart=store.cart.filter(item=>item.slug!==slug)},setQty(){}};
 const useShop=selector=>selector(store);useShop.getState=()=>({updatePrice(slug,priceGBP,comparePriceGBP){updates.push({slug,priceGBP,comparePriceGBP})}});
 const query={select(){return this},eq(){return this},async maybeSingle(){return result}};
 const inventory=await import('../../src/lib/cart-inventory.ts');
 const source=(await fs.readFile('src/hooks/useCartInventory.ts','utf8'));
 const exports={};const modules={
  react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>states[i]=value]},useEffect:fn=>effects.push(fn)},
  sonner:{toast:{error(){}}},'@/store/shop':{useShop},'@/lib/cart-inventory':inventory,
  '@/lib/supabase':{isSupabaseConfigured:()=>true,supabase:{from:()=>query}},
 };
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>modules[name],window:{addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]}});
 exports.useCartInventory(items);const cleanup=effects[0]();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(updates[0],{slug:items[0].slug,priceGBP:138.99,comparePriceGBP:170.14});
 result={data:null,error:{message:'offline'}};listeners.focus();await new Promise(resolve=>setImmediate(resolve));assert.equal(store.cart.length,1);assert.deepEqual(Object.keys(states[0]),[]);
 result={data:null,error:null};listeners.focus();await new Promise(resolve=>setImmediate(resolve));
 cursor=0;effects=[];exports.useCartInventory(items);effects[1]();assert.equal(store.cart.length,0);cleanup();
});

test('release sitemap and prerender selection omit inactive products and empty collections in every language',async()=>{
 const source=await fs.readFile('src/prerender-home.tsx','utf8');
 const code=source.slice(source.indexOf('export async function publishedPublicUrls'),source.indexOf('export async function renderPublicPage'));
 const exports={};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
   exports,URL,getStorefrontProducts:async()=>[{slug:'active-jacket',collections:['featured']}],
   getPublishedPosts:async locale=>locale==='en'?[{slug:'live-blog'},{slug:'new-cms-blog'}]:locale==='fr'?[{slug:'guide'}]:[],
  CATEGORY_CHILDREN:{'leather-jackets':['classic']},COLLECTIONS:[{slug:'featured'},{slug:'empty'}],resolveSlug:slug=>slug,
  collectionAudience:()=>null,isProductForAudience:()=>true,
 });
 for(const locale of ['en','de','fr','it','es']){
  const urls=['/shop','/product/active-jacket','/product/draft-jacket','/product/archived-jacket','/collections/featured','/collections/empty','/women-leather-jackets'].map(path=>'https://tuxar.co.uk/'+locale+path);
  const published=await exports.publishedPublicUrls(urls);
  assert.deepEqual(Array.from(published),[urls[0],urls[1],urls[4]]);
 }
  const urls=['https://tuxar.co.uk/en/blog/archived-blog','https://tuxar.co.uk/en/blog/live-blog','https://tuxar.co.uk/en/shop'];
  const published=await exports.publishedPublicUrls(urls);
  assert.deepEqual(Array.from(published).sort(),['https://tuxar.co.uk/en/blog/live-blog','https://tuxar.co.uk/en/blog/new-cms-blog','https://tuxar.co.uk/en/shop','https://tuxar.co.uk/fr/blog/guide'].sort());
});

test('adding the same variant again replaces its saved price and recalculates the bag total',async()=>{
 const {useShop,cartTotalGBP}=await import('../../src/store/shop.ts');
 const saved=useShop.getState().cart;
 useShop.setState({cart:[]});
 try{
  useShop.getState().addToCart({slug:'repriced',name:'Unchanged name',image:'/jacket.webp',size:'M',color:'Black',qty:1,priceGBP:189});
  useShop.getState().addToCart({slug:'repriced',name:'Unchanged name',image:'/jacket.webp',size:'M',color:'Black',qty:1,priceGBP:138.99,comparePriceGBP:170.14});
  assert.equal(useShop.getState().cart.length,1);assert.equal(useShop.getState().cart[0].qty,2);
  assert.equal(cartTotalGBP(useShop.getState().cart),277.98);
  useShop.getState().updatePrice('repriced',120);assert.equal(cartTotalGBP(useShop.getState().cart),240);
  assert.equal(useShop.getState().cart[0].comparePriceGBP,undefined);
 }finally{useShop.setState({cart:saved})}
});
