import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as categories from '../../src/lib/catalogCategories.ts';
import * as audience from '../../src/lib/product-audience.ts';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
function compile(source,modules={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(source.replaceAll('import.meta.env.DEV','false'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},URL,URLSearchParams,...globals});return exports;}
const evaluate=async(file,modules,globals)=>compile(await fs.readFile(file,'utf8'),modules,globals);
const data=await evaluate('src/data/product-types.ts',{'@/assets':{getProductAsset:value=>value}});
const options=await evaluate('src/lib/preview-category-options.ts',{'@/data/products':data,'@/lib/catalogCategories':categories,'@/lib/product-audience':audience});
const helpers=()=>({'@/i18n/i18n':{getLocalizedSlug:slug=>slug},'@/lib/preview-category-options':options,'@/lib/product-audience':audience,'@/lib/catalogCategories':categories});
function hooks(){let cursor=0;const states=[],effects=[];return {states,effects,reset(){cursor=0;effects.length=0},react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value]},useEffect:fn=>effects.push(fn)}};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('every built-in live menu category is available in its admin audience, alongside custom categories and without the Bomber alias',async()=>{
 const api=await evaluate('src/lib/admin-category-catalogue.ts',helpers());
 const header=await fs.readFile('src/components/site/Header.tsx','utf8');
 const source=header.slice(header.indexOf('function menLinks('),header.indexOf('// ─── Announcement bar'))+';exports.men=menLinks;exports.women=womenLinks;';
 const menus=compile(source,{}, {getLocalizedSlug:slug=>slug});
 const rows=[{id:'alias',slug:'bomber',name:'Bomber',audience:'both'},{id:'canonical',slug:'bomber-jackets',name:'Bomber Jackets',audience:'men'},{id:'custom',slug:'limited-custom',name:'Custom',audience:'both'}];
 for(const group of ['men','women']){
  const visible=api.adminCategoryRows(rows,group);const ids=new Set(visible.map(row=>row.slug));
  for(const link of Object.values(menus[group]('en')).flat())assert.ok(ids.has(link.params?.slug??link.to.split('/').at(-1)),group+': '+link.label);
  assert.ok(ids.has('limited-custom'));assert.ok(!ids.has('bomber'));assert.equal(ids.size,visible.length);
 }
 const renamed=api.adminCategoryRows([{id:'old',slug:'aviator-jackets',name:'Aviator Jackets',audience:'both'}],'women').find(row=>row.id==='old');
 assert.equal(renamed.name,'Leather Round Jackets');assert.equal(api.adminCategoryStorefrontHref(renamed,'women'),'/en/collections/women-aviator-jackets');
 const men=api.adminCategoryRows(rows,'men');assert.equal(men.find(row=>row.slug==='bomber-jackets').id,'canonical');
 assert.deepEqual(categories.storefrontManagedCategories(rows,'men').map(row=>row.slug),['bomber-jackets','limited-custom']);
 assert.equal(categories.categoryIncludes('bomber-jackets','bomber'),true);
 assert.ok(header.includes('storefrontManagedCategories(managedCategories, audience)'));
});
test('Men/Women choice survives remount and preserves router history state',async()=>{
 const history={state:{__TSR_index:4},replaceState(state,unused,url){this.state=state;location.href=String(url);location.search=new URL(String(url)).search}};
 const location={href:'https://tuxar.co.uk/en/admin?section=categories',search:'?section=categories'};
 const api=await evaluate('src/lib/admin-category-catalogue.ts',helpers(),{window:{location,history}});
 api.persistCategoryAudience('men');assert.equal(api.readCategoryAudience(),'men');assert.equal(history.state.__TSR_index,4);
 const remounted=await evaluate('src/lib/admin-category-catalogue.ts',helpers(),{window:{location,history}});assert.equal(remounted.readCategoryAudience(),'men');
 api.persistCategoryAudience('women');assert.equal(api.readCategoryAudience(),'women');api.persistCategoryAudience(null);assert.equal(api.readCategoryAudience(),null);
});
test('staff workspace stays mounted during same-user revalidation and never carries an old role to another user',async()=>{
 const h=hooks(),auth={user:{id:'staff-1'},isLoading:false,logout(){},loginWithEmail(){}};const Gate=()=>null;
 const q={select(){return this},eq(){return this},async maybeSingle(){return {data:{role:'owner'}}}};
 const {Route}=await evaluate('src/routes/$locale.admin.tsx',{'react':h.react,'react/jsx-runtime':jsx,'@tanstack/react-router':{createFileRoute:()=>options=>options},'@/hooks/useUser':{useUser:()=>auth},'@/lib/supabase':{supabase:{from:()=>q}},'@/components/admin/AdminMfaGate':{AdminMfaGate:Gate}});
 const render=()=>{h.reset();return Route.component()};render();h.effects[0]();await settle();const ready=render();assert.equal(ready.type,Gate);assert.equal(ready.props.rechecking,false);
 auth.isLoading=true;const refresh=render();assert.equal(refresh.type,Gate);assert.equal(refresh.key,ready.key);assert.equal(refresh.props.children.type,ready.props.children.type);assert.equal(refresh.props.rechecking,true);
 auth.isLoading=false;auth.user={id:'staff-2'};assert.notEqual(render().type,Gate);auth.user=null;assert.notEqual(render().type,Gate);
});
test('MFA refresh retains workspace state while hiding access until assurance is checked again',async()=>{
 const h=hooks();let level='aal2';const child={type:'workspace',props:{}};
 const mfa={async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level}}},async listFactors(){return {data:{totp:[]}}}};
 const {AdminMfaGate}=await evaluate('src/components/admin/AdminMfaGate.tsx',{react:h.react,'react/jsx-runtime':jsx,'@/lib/supabase':{supabase:{auth:{mfa}}}});
 const render=rechecking=>{h.reset();return AdminMfaGate({children:child,logout(){},rechecking})};
 render(false);h.effects[0]();await settle();let tree=render(false);assert.equal(tree.props.children.props.children,child);assert.equal(tree.props.children.props.hidden,false);
 tree=render(true);assert.equal(tree.props.children[0].props.children,child);assert.equal(tree.props.children[0].props.hidden,true);assert.equal(tree.props.children[0].props.inert,true);h.effects[0]();
 level='aal1';render(false);h.effects[0]();await settle();tree=render(false);assert.equal(tree.props.children[0].props.children,child);assert.equal(tree.props.children[0].props.hidden,true);
});

test('successful two-factor verification mounts the workspace immediately; failed assurance never grants it',async()=>{
 for(const accepted of [false,true]){
  const h=hooks();let level='aal1';const child={type:'workspace',props:{}};
  const mfa={async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level}}},async listFactors(){return {data:{totp:[{id:'verified-factor',status:'verified'}]}}},async challengeAndVerify(){if(accepted)level='aal2';return {error:null}}};
  const {AdminMfaGate}=await evaluate('src/components/admin/AdminMfaGate.tsx',{react:h.react,'react/jsx-runtime':jsx,'@/lib/supabase':{supabase:{auth:{mfa}}}});
  const render=()=>{h.reset();return AdminMfaGate({children:child,logout(){}})};
  render();h.effects[0]();await settle();
  let tree=render();let form=tree.props.children[1].props.children.find(node=>node?.type==='form');assert.ok(form);
  const label=form.props.children.find(node=>node?.type==='label');
  label.props.children.find(node=>node?.type==='input').props.onChange({target:{value:'123456'}});
  tree=render();form=tree.props.children[1].props.children.find(node=>node?.type==='form');
  await form.props.onSubmit({preventDefault(){}});
  tree=render();
  if(accepted){assert.equal(tree.props.children.props.children,child);assert.equal(tree.props.children.props.hidden,false)}
  else assert.equal(tree.props.children[0],false);
 }
});

test('a missing built-in category opens in the real editor and creates its database row only on Save',async()=>{
 const h=hooks(),writes=[];const slug='women-leather-blazers';const location={href:'https://tuxar.co.uk/en/admin/categories/storefront--'+slug+'?audience=women',search:'?audience=women'};
 const history={state:{__TSR_index:2},replaceState(state,unused,url){location.href=String(url)}};
 const api=await evaluate('src/lib/admin-category-catalogue.ts',helpers());
 const supabase={from(table){let saved;const q={select(){return q},eq(key,value){if(saved){writes.push({action:'update',values:saved,key,value});return Promise.resolve({error:null})}return q},async maybeSingle(){return {data:null,error:null}},async order(){return {data:[],error:null}},insert(values){writes.push({action:'insert',values});saved=values;return q},update(values){saved=values;return q},async single(){return {data:{...saved,id:'saved-id'},error:null}}};return q}};
 const {AdminCategoryEditor}=await evaluate('src/components/admin/AdminCategoryEditor.tsx',{
  react:{...h.react,useCallback:fn=>fn},'react/jsx-runtime':jsx,'lucide-react':{},sonner:{toast:{error:message=>assert.fail(message),success(){}}},
  '@/lib/admin-category-catalogue':api,'@/lib/product-audience':audience,'@/lib/catalogCategories':categories,'@/lib/supabase':{supabase},
 },{window:{location,history}});
 const props={id:'storefront--'+slug,locale:'en'};const Component=AdminCategoryEditor(props).type;
 const render=()=>{h.reset();return Component(props)};render();h.effects[0]();await settle();assert.equal(writes.length,0);
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const value=find(child,predicate);if(value)return value}return null}
 let tree=render();let form=find(tree,node=>node.type==='form');assert.ok(form);await form.props.onSubmit({preventDefault(){}});
 assert.equal(writes.length,1);assert.equal(writes[0].action,'insert');assert.equal(writes[0].values.slug,slug);assert.equal(writes[0].values.audience,'women');assert.ok(location.href.includes('saved-id'));
 tree=render();form=find(tree,node=>node.type==='form');await form.props.onSubmit({preventDefault(){}});assert.equal(writes[1].action,'update');assert.equal(writes[1].value,'saved-id');
});
