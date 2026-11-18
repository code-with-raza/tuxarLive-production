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
 const {AdminMediaManager}=await evaluate('src/components/admin/AdminMediaManager.tsx',{react:h.react,'react/jsx-runtime':jsx,'lucide-react':{},'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/cloudinary':cloudinary,sonner:{toast:{}}});
 const render=()=>{h.reset();return AdminMediaManager({entityType:'homepage-banner',entityKey:'en',contextName:'Campaign',onSelect:image=>chosen.push(image)})};
 render();h.effects[0]();await settle();const tree=render();const button=find(tree,node=>node.type==='button'&&text(node)==='Use this image');assert.ok(button);button.props.onClick();assert.equal(chosen[0].secure_url,asset.secure_url);
 const thumbnail=find(tree,node=>node.type==='img');assert.match(thumbnail.props.className,/object-contain/);assert.match(thumbnail.props.src,/c_fit/);assert.ok(!thumbnail.props.src.includes('h_300'));
});

test('Add image opens the local picker directly, including when returning from URL mode',async()=>{
 const h=hooks();let opened=0,requests=0;
 const {AdminMediaManager}=await evaluate('src/components/admin/AdminMediaManager.tsx',{react:h.react,'react/jsx-runtime':jsx,'lucide-react':{},'@/lib/supabase':{supabase:{from(){requests++;throw Error('Picking a file must not write to the database')}}},'@/lib/cloudinary':cloudinary,sonner:{toast:{}}});
 const render=()=>{h.reset();return AdminMediaManager({entityType:'homepage-banner',entityKey:'en',contextName:'Campaign'})};
 let tree=render();const input=find(tree,node=>node.type==='input'&&node.props.type==='file');assert.ok(input);
 input.props.ref.current={click(){opened++}};
 find(tree,node=>node.type==='button'&&text(node).trim()==='Add image').props.onClick();
 assert.equal(opened,1,'the first click must open the picker rather than only select a tab');
 find(tree,node=>node.type==='button'&&text(node).trim()==='Add URL').props.onClick();tree=render();
 assert.ok(find(tree,node=>node.type==='input'&&node.props.type==='file'));
 find(tree,node=>node.type==='button'&&text(node).trim()==='Add image').props.onClick();
 assert.equal(opened,2,'the picker must also open on the first click from URL mode');
 tree=render();find(tree,node=>node.type==='button'&&text(node).includes('Choose an image')).props.onClick();
 assert.equal(opened,3);assert.equal(requests,0);
});

test('cancelling or rejecting an oversized local image leaves the picker ready to retry',async()=>{
 const h=hooks(),errors=[];
 const {AdminMediaManager}=await evaluate('src/components/admin/AdminMediaManager.tsx',{react:h.react,'react/jsx-runtime':jsx,'lucide-react':{},'@/lib/supabase':{supabase:{functions:{invoke(){assert.fail('Cancelled/oversized files must not request an upload')}}}},'@/lib/cloudinary':cloudinary,sonner:{toast:{error:message=>errors.push(message)}}});
 h.reset();const tree=AdminMediaManager({entityType:'homepage-banner',entityKey:'en',contextName:'Campaign'});
 const input=find(tree,node=>node.type==='input'&&node.props.type==='file');
 const cancelled={files:[],value:''};input.props.onChange({currentTarget:cancelled});assert.equal(errors.length,0);
 const oversized={files:[{size:5*1024*1024+1}],value:'selected-file.png'};
 input.props.onChange({currentTarget:oversized});assert.equal(oversized.value,'');assert.match(errors[0],/5 MB/);
});
test('Banners is available to catalogue staff but not fulfilment-only staff',async()=>{
 const source=await fs.readFile('src/routes/$locale.admin.tsx','utf8');const body=source.slice(source.indexOf('function allowedSections('),source.indexOf('function AdminPage('))+';exports.allowed=allowedSections;';const api=compile(body);
 for(const role of ['owner','admin','editor'])assert.ok(api.allowed(role).includes('banners'));assert.ok(!api.allowed('fulfilment').includes('banners'));
 assert.ok(source.includes('id: "banners", label: "Banners"'));assert.ok(source.includes('section === "banners"'));
});
