import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as cloudinary from '../../src/lib/cloudinary.ts';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
function compile(source,modules={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},URL,...globals});return exports;}
const evaluate=async(file,modules,globals)=>compile(await fs.readFile(file,'utf8'),modules,globals);
const campaign=await evaluate('src/lib/homepage-campaign.ts',{'./cloudinary':cloudinary});
const destinationApi=await evaluate('src/lib/banner-destinations.ts',{'@/data/products':{COLLECTIONS:[{slug:'cafe-racer-jackets',title:'Cafe Racer Jackets'}]},'@/i18n/i18n':{getLocalizedSlug:(slug,type,locale)=>locale+'-'+slug,getLocalizedCollection:row=>row,getLocalizedProduct:row=>row}});
function hooks(){let cursor=0;const values=[],effects=[];return {effects,reset(){cursor=0;effects.length=0},react:{useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],value=>values[i]=typeof value==='function'?value(values[i]):value]},useRef(initial){const i=cursor++;return values[i]??=( {current:initial})},useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useMemo:fn=>fn()}};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const value=find(child,predicate);if(value)return value}return null}
const text=node=>typeof node==='string'?node:node&&typeof node==='object'?[node.props?.children].flat(Infinity).map(text).join(' '):'';
const asset={id:'image-1',secure_url:'https://res.cloudinary.com/demo/image/upload/banner.webp',alt_text:'A leather collection campaign',width:1920,height:640,title:'Campaign image'};
test('banner destinations include real localized pages, collections and the active product list',()=>{
 const options=destinationApi.bannerDestinations('fr',[{slug:'active-jacket',name:'Existing product name'}]);
 assert.ok(options.some(row=>row.href==='/fr/shop'));assert.ok(options.some(row=>row.href==='/fr/collections/fr-cafe-racer-jackets'));
 assert.ok(options.some(row=>row.href==='/fr/product/fr-active-jacket'&&row.label==='Existing product name'));
 assert.equal(new Set(options.map(row=>row.href)).size,options.length);assert.ok(options.every(row=>campaign.validBannerDestination(row.href)));
 assert.ok(!options.some(row=>row.href.includes('/admin')||row.href.includes('/account')));
});
test('existing uploaded images can be selected without uploading a second copy',async()=>{
 const h=hooks(),chosen=[];const q={select(){return this},eq(){return this},async order(){return {data:[asset]}}};
 const {AdminMediaManager}=await evaluate('src/components/admin/AdminMediaManager.tsx',{react:h.react,'react/jsx-runtime':jsx,'lucide-react':{},'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/cloudinary':{cloudinaryUrl:url=>url},sonner:{toast:{}}});
 const render=()=>{h.reset();return AdminMediaManager({entityType:'homepage-banner',entityKey:'en',contextName:'Campaign',onSelect:image=>chosen.push(image)})};
 render();h.effects[0]();await settle();const tree=render();const button=find(tree,node=>node.type==='button'&&text(node)==='Use this image');assert.ok(button);button.props.onClick();assert.equal(chosen[0].secure_url,asset.secure_url);
});
test('Banners is available to catalogue staff but not fulfilment-only staff',async()=>{
 const source=await fs.readFile('src/routes/$locale.admin.tsx','utf8');const body=source.slice(source.indexOf('function allowedSections('),source.indexOf('function AdminPage('))+';exports.allowed=allowedSections;';const api=compile(body);
 for(const role of ['owner','admin','editor'])assert.ok(api.allowed(role).includes('banners'));assert.ok(!api.allowed('fulfilment').includes('banners'));
 assert.ok(source.includes('id: "banners", label: "Banners"'));assert.ok(source.includes('section === "banners"'));
});
