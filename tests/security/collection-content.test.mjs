import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as content from '../../src/lib/collection-content.ts';

const title='Men’s Cafe Racer Jackets | Tuxar';
const description='Explore men’s cafe racer jackets with stand collars, striped sleeves and quilted details. Compare materials, colours and sizes, with UK delivery options.';
const fallback={slug:'cafe-racer-jackets',title:'Built-in title',description:'Built-in description',seoTitle:'Default SEO',metaIntro:'Default summary',image:'/image.webp',seoContent:'Details'};
const row={id:'a1cdd160-81c5-460a-8970-7db25700b4a1',slug:fallback.slug,name:"Men's Cafe Racer Jackets",description:'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',seo_title:title,seo_description:description,status:'active',updated_at:'2026-11-21T00:00:00Z',content_translations:{de:{name:'Cafe-Racer-Jacken',description:'Deutscher Text',seo_title:'Deutscher Titel'}}};
const fields=source=>({name:source.name,description:source.description,seo_title:source.seo_title??'',seo_description:source.seo_description??''});
function compile(source,modules={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},AbortSignal,URL});
  return exports;
}

test('saved heading, paragraphs and SEO override the localized defaults without changing the handle',()=>{
  const result=content.applyCollectionContent(fallback,row,'en');
  assert.equal(result.title,row.name);assert.equal(result.description,row.description);
  assert.equal(result.description.split('\n\n').length,3);
  assert.equal(result.slug,'cafe-racer-jackets');assert.equal(result.seoTitle,title);assert.equal(result.seoDescription,description);
  const blank=content.applyCollectionContent(fallback,{...row,seo_title:' ',seo_description:''},'en');
  assert.equal(blank.seoTitle,'Default SEO');assert.equal(blank.seoDescription,undefined);
  assert.equal(content.applyCollectionContent(fallback,null,'en'),fallback);
});
test('English edits never replace another language and editing one translation preserves all others',()=>{
  const french={...fallback,title:'Vestes françaises',description:'Texte français'};
  assert.equal(content.applyCollectionContent(french,row,'fr'),french);
  const german=content.applyCollectionContent(french,row,'de');
  assert.equal(german.title,'Cafe-Racer-Jacken');assert.equal(german.seoTitle,'Deutscher Titel');
  const values=content.collectionEditValues(row,{en:{...fields(row),name:'New English name'},fr:{name:'Vestes',description:'Un\n\nDeux',seo_title:'Titre',seo_description:'Résumé'}});
  assert.equal(values.name,'New English name');assert.equal(values.content_translations.de.seo_title,'Deutscher Titel');
  assert.equal(values.content_translations.fr.description,'Un\n\nDeux');
  assert.equal(values.slug,undefined);assert.equal(values.status,undefined);
});
test('the admin list retains a saved collection name instead of replacing it with its built-in label',async()=>{
  const api=compile(await fs.readFile('src/lib/admin-category-catalogue.ts','utf8'),{
    '@/i18n/i18n':{getLocalizedSlug:slug=>slug},
    '@/lib/catalogCategories':{storefrontManagedCategories:rows=>rows},
    '@/lib/preview-category-options':{PREVIEW_CATEGORY_OPTIONS:[fallback]},
    '@/lib/product-audience':{collectionAudience:()=> 'men',getAudienceCollection:()=>null},
  });
  assert.equal(api.adminCategoryRows([row],'men')[0].name,row.name);
});
test('save confirms a persisted row and reload retains values; zero-row and network failures reject',async()=>{
  let stored={...row},error=null;
  const writes=[];
  const client={from(table){assert.equal(table,'product_categories');let values;const filters=[];const q={update(v){values=v;return q},insert(v){values=v;return q},eq(...args){filters.push(args);return q},select(){return q},async single(){if(error)return{data:null,error};writes.push({values,filters});stored={...stored,...values};return{data:{...stored},error:null}}};return q}};
  const values=content.collectionEditValues(row,{en:fields(row)});
  const saved=await content.persistCollectionContent(client,row,values);
  assert.equal(saved.seo_title,title);assert.equal({...stored}.description,row.description);
  assert.ok(writes[0].filters.some(([key,value])=>key==='id'&&value===row.id));
  assert.ok(writes[0].filters.some(([key,value])=>key==='updated_at'&&value===row.updated_at));
  error={code:'PGRST116',message:'No rows'};
  await assert.rejects(content.persistCollectionContent(client,row,values),/changed or could not be updated/);
  error={code:'PGRST204',message:'missing column'};
  await assert.rejects(content.persistCollectionContent(client,row,values),/migration/);
  error={message:'offline'};
  await assert.rejects(content.persistCollectionContent(client,row,values),/not saved: offline/);
  assert.equal(writes.length,1);
});
test('public loader reads the same canonical row and public metadata uses it on navigation and SSR',async()=>{
  let record=row;
  const filters=[];
  const q={select(){return q},eq(...args){filters.push(args);return q},abortSignal(){return q},async maybeSingle(){return {data:record,error:null}}};
  const getter=compile(await fs.readFile('src/lib/storefront-collection-content.ts','utf8'),{'./supabase':{isSupabaseConfigured:()=>true,publicSupabase:{from:()=>q}},'./collection-content':content});
  const product={slug:'jacket',name:'Jacket',collections:[fallback.slug],priceGBP:127};
  const modules={
    '@tanstack/react-router':{createFileRoute:()=>config=>config},
    '@/lib/storefront-products':{getStorefrontProducts:async()=>[product]},
    '@/lib/storefront-collection-content':getter,
    '@/data/products':{COLLECTIONS:[fallback]},
    '@/i18n/i18n':{resolveSlug:s=>s,getLocalizedCollection:c=>c,getLocalizedSlug:s=>s,getLocalizedProduct:p=>p,t:()=> 'Label'},
    '@/lib/product-audience':{collectionAudience:()=> 'men',isProductForAudience:()=>true},
    '@/lib/seo':{absoluteUrl:path=>new URL(path,'https://tuxar.co.uk').href,localizedAlternates:()=>[]},
  };
  const {Route}=compile(await fs.readFile('src/routes/$locale.collections.$slug.tsx','utf8'),modules);
  const params={locale:'en',slug:fallback.slug};
  let data=await Route.loader({params});
  assert.equal(data.collection.title,row.name);assert.equal(data.products[0].priceGBP,127);
  assert.ok(filters.some(([key,value])=>key==='slug'&&value===fallback.slug));
  const head=Route.head({loaderData:data,params});
  assert.equal(head.meta.find(meta=>meta.title)?.title,title);
  assert.equal(head.meta.find(meta=>meta.name==='description').content,description);
  assert.equal(head.links[0].href,'https://tuxar.co.uk/en/collections/cafe-racer-jackets');
  const unsafeDescription='Text </script><script>alert(1)</script>';
  const safeHead=Route.head({loaderData:{...data,collection:{...data.collection,description:unsafeDescription}},params});
  assert.ok(!safeHead.scripts[0].children.includes('</script>'));
  assert.equal(JSON.parse(safeHead.scripts[0].children).description,unsafeDescription);
  record={...row,name:'Later saved heading'};
  data=await Route.loader({params});assert.equal(data.collection.title,'Later saved heading');
  record=null;
  assert.equal((await getter.getStorefrontCollectionContent({...fallback,slug:'another-collection'},'en')).title,fallback.title);
});
test('metadata migration preserves saved copy, translations, publication, memberships, prices and stock',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create table public.product_categories(id text,slug text,name text,description text,status text,updated_at timestamptz default now());
      insert into public.product_categories(id,slug,name,description,status) values ('one','cafe-racer-jackets','Saved name',E'First\\n\\nSecond','active'),('two','other','Other collection','Other description','hidden');
      create table public.products(slug text,price_pence integer,stock integer);insert into public.products values('jacket',12700,10);
      create table public.product_collections(product_slug text,collection_slug text);insert into public.product_collections values('jacket','cafe-racer-jackets');`);
    const before=(await db.query('select slug,name,description,status from product_categories order by slug')).rows;
    await db.exec(await fs.readFile('supabase/migrations/202611210001_collection_content_seo.sql','utf8'));
    const saved=(await db.query("select * from product_categories where slug='cafe-racer-jackets'")).rows[0];
    assert.equal(saved.name,'Saved name');assert.equal(saved.status,'active');assert.equal(saved.seo_title,title);assert.equal(saved.seo_description,description);
    assert.deepEqual((await db.query('select slug,name,description,status from product_categories order by slug')).rows,before);
    assert.equal((await db.query("select status from product_categories where slug='other'")).rows[0].status,'hidden');
    assert.deepEqual((await db.query('select * from products')).rows,[{slug:'jacket',price_pence:12700,stock:10}]);
    assert.deepEqual((await db.query('select * from product_collections')).rows,[{product_slug:'jacket',collection_slug:'cafe-racer-jackets'}]);
  } finally {await db.close()}
});
