import test from 'node:test';
import { categoryIncludes } from '../../src/lib/catalogCategories.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { isProductForAudience } from '../../src/lib/product-audience.ts';
const require = createRequire(import.meta.url);
const code = ts.transpileModule((await fs.readFile('src/components/admin/AdminCategories.tsx','utf8')).replaceAll('import.meta.env.DEV','false'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function find(node,predicate) {
  if (!node || typeof node!=='object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match=find(child,predicate); if(match)return match; }
}
const text = node => !node ? '' : typeof node==='string'||typeof node==='number' ? String(node) : [node.props?.children].flat(Infinity).map(text).join(' ');
async function mount() {
  const states=[],effects=[],writes=[],errors=[];
  let cursor=0;
  const products=[{id:'m',slug:'mens-test',name:"Men's jacket",category:'leather-jackets',product_variants:[]},{id:'w',slug:'womens-test',name:"Women's jacket",category:'leather-jackets',product_variants:[]},{id:'a',slug:'mens-gloves',name:"Men's gloves",category:'accessories',product_variants:[]}];
  const categories=[{id:'jackets',slug:'leather-jackets',name:'Leather Jackets',audience:'both'},{id:'accessories',slug:'accessories',name:'Accessories',audience:'both'}];
  const exports={};
  const modules={
    react:{...require('react'),useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=value}];},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},
    'react/jsx-runtime':require('react/jsx-runtime'),
    'lucide-react':{},sonner:{toast:{error:message=>errors.push(message),success(){}}},
    '@/lib/supabase':{supabase:{from(table){const q={select(){return q},order(){return Promise.resolve({data:table==='products'?products:categories})},delete(){writes.push(table);return q},eq(){return Promise.resolve({})}};return q;}}},
    '@/components/admin/AdminMediaManager':{},
    '@/lib/catalogCategories':{categoryIncludes:(a,b)=>a===b,categoryLabel:value=>value},
    '@/lib/product-audience':{isProductForAudience},
    '@/lib/admin-category-catalogue':{adminCategoryRows:(rows,audience)=>rows.filter(row=>row.audience==='both'||row.audience===audience),adminCategoryStorefrontHref:row=>"/en/"+row.slug,isVirtualCategory:()=>false,readCategoryAudience:()=>null,persistCategoryAudience(){}},
    '@/components/admin/PreviewCatalogueEditors':{PreviewCategoryWorkspace(){throw Error('Production must not use browser-only preview storage')}},
  };
  vm.runInNewContext(code,{exports,require:name=>modules[name],window:{location:{pathname:'/en/admin'},confirm(){throw Error('A shared category is still in use')}}});
  const component=exports.AdminCategories().type;
  const render=()=>{cursor=0;return component()};
  const initial=render();
  effects[0]();
  for(let i=0;i<12;i++)await Promise.resolve();
  return{initial,render,writes,errors,choose(audience){find(initial,node=>node.type==='button'&&node.props.children?.[0]===audience).props.onClick();}};
}
test('style memberships share a category across audiences and retain broad leather-jacket membership',()=>{
  for (const slug of ['suede-jackets','women-suede-jackets']) {
    const membership=[{collection_slug:slug}];
    assert.equal(categoryIncludes('suede','leather-jackets',membership),true);
    assert.equal(categoryIncludes('suede-jackets','leather-jackets',membership),true);
    assert.equal(categoryIncludes('leather-jackets','leather-jackets',membership),true);
    assert.equal(categoryIncludes('bomber','leather-jackets',membership),false);
  }
});

test('production category entry shows Men/Women and isolates assigned products using real category state',async()=>{
  const h=await mount();
  assert.match(text(h.initial),/men/);assert.match(text(h.initial),/women/);
  h.choose('women');
  let tree=h.render();
  assert.match(text(tree),/women\s+categories/);
  const row=find(tree,node=>node.type==='tr'&&text(node).includes('Leather Jackets'));
  const products=find(row,node=>node.type==='button'&&node.props.children?.[0]===1);
  assert.ok(products,'only the women product is counted');
  products.props.onClick();tree=h.render();
  assert.match(text(tree),/Women's jacket/);assert.doesNotMatch(text(tree),/Men's jacket/);
  assert.deepEqual(h.writes,[]);
});
test('a shared category cannot be deleted just because its selected audience has zero assigned products',async()=>{
  const h=await mount();h.choose('women');
  const row=find(h.render(),node=>node.type==='tr'&&text(node).includes('Accessories'));
  await find(row,node=>node.type==='button'&&text(node).includes('Delete')).props.onClick();
  assert.deepEqual(h.writes,[]);assert.match(h.errors[0],/1 assigned product/);
});
