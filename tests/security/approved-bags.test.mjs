import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
const bags=JSON.parse(fs.readFileSync('src/data/products/approved-bags-catalogue.json','utf8')).products;
function evaluate(file,dev=false,ssr=true,cache=new Map()) {
 if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const input=fs.readFileSync(file,'utf8').replaceAll('import.meta.env.DEV',String(dev)).replaceAll('import.meta.env.SSR',String(ssr));
 vm.runInNewContext(ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(name){
  if(name==='@/assets'){const images=JSON.parse(fs.readFileSync('src/data/cloudinary-assets.json','utf8'));return{getProductAsset:src=>images[src]?.url??src};}
  if(name==='@/lib/catalogue-preview-edits')return{previewProduct:p=>p};
  const target=name.startsWith('@/')?'src/'+name.slice(2):path.join(path.dirname(file),name);
  return target.endsWith('.json')?{default:JSON.parse(fs.readFileSync(target,'utf8'))}:evaluate(target+'.ts',dev,ssr,cache);
 }});return exports;
}
test('approved bags are production products with no draft ordering guard and have localized sitemap URLs',()=>{
 assert.equal(bags.length,11);
 for(const [dev,ssr]of [[false,false],[false,true],[true,false]]){
  const catalogue=evaluate('src/data/products.ts',dev,ssr);
  const local=evaluate('src/lib/local-catalogue.ts',dev,ssr);
  assert.equal(catalogue.PRODUCTS.length,252);
  assert.equal(new Set(catalogue.PRODUCTS.map(p=>p.slug)).size,252);
  for(const bag of bags){const p=catalogue.getProductBySlug(bag.slug);assert.ok(p.inStock);assert.equal(p.cataloguePreview,undefined);assert.equal(local.getLocalCatalogueProduct(p.slug),undefined);assert.match(p.image,/^https:\/\/res\.cloudinary\.com\//);}
 }
 const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
 for(const locale of ['en','de','fr','it','es']){
  const dictionary=JSON.parse(fs.readFileSync(`src/i18n/locales/${locale}.json`,'utf8'));
  for(const bag of bags){const translated=dictionary.products[bag.slug];assert.ok(translated.name&&translated.description&&translated.slug);assert.ok(sitemap.includes(`https://tuxar.co.uk/${locale}/product/${translated.slug}`));if(locale!=='en')assert.notEqual(translated.description,bag.description);}
 }
});
test('bag activation validates drafts atomically and reruns preserve sold stock and current prices',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const schema=fs.readFileSync('supabase/migrations/202609130003_catalog_content.sql','utf8').split('create table if not exists public.blog_posts')[0];
 await db.exec(schema);
 await db.exec("create table public.product_categories(slug text primary key,status text);insert into public.product_categories values('leather-bags','active');insert into public.products(slug,name,category,price_pence,status) values('existing-bag','Existing','leather-bags',34900,'active');");
 await db.exec(fs.readFileSync('tests/fixtures/catalogue-sql/02-IMPORT-11-BAGS-AS-DRAFTS.sql','utf8'));
 const activate=fs.readFileSync('tests/fixtures/catalogue-sql/04-ACTIVATE-11-APPROVED-BAGS.sql','utf8');
 await db.query('update public.products set price_pence=1 where slug=$1',[bags[0].slug]);
 await assert.rejects(()=>db.exec(activate),/price differs/);await db.exec('rollback');
 assert.equal(Number((await db.query("select count(*) n from public.products where status='draft'")).rows[0].n),11);
 await db.query('update public.products set price_pence=$1 where slug=$2',[bags[0].priceGBP*100,bags[0].slug]);
 await db.exec(activate);
 await db.query('update public.product_variants set stock=10 where product_id=(select id from public.products where slug=$1)',[bags[0].slug]);
 await db.query('update public.products set price_pence=10800 where slug=$1',[bags[0].slug]);
 await db.exec(activate);
 assert.equal((await db.query('select stock from public.product_variants where product_id=(select id from public.products where slug=$1)',[bags[0].slug])).rows[0].stock,10);
 assert.equal((await db.query('select price_pence from public.products where slug=$1',[bags[0].slug])).rows[0].price_pence,10800);
 assert.equal((await db.query("select price_pence from public.products where slug='existing-bag'")).rows[0].price_pence,34900);
});
