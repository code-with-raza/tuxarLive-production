import * as discounts from '../../src/lib/product-discount.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import * as cloudinary from '../../src/lib/cloudinary.ts';
import { marketStub } from './helpers/market-stub.mjs';

const code=ts.transpileModule(await fs.readFile('src/components/site/ProductCard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function images(node){
 if(!node||typeof node!=='object')return [];
 return [...(node.type==='img'?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(images)];
}
function card(priority=false,overrides={}){
 let cursor=0;const states=[],exports={};
 const modules={
  react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value}];}},
  'react/jsx-runtime':jsxRuntime,
  '@tanstack/react-router':{useParams:()=>({locale:'en'}),Link:'a'},
  '@/lib/market':marketStub, '@/lib/product-discount':discounts,
  '@/store/shop':{useShop:selector=>selector({wishlist:[],toggleWish(){}})},
  '@/i18n/i18n':{getLocalizedProduct:p=>p,getLocalizedLink:()=>({to:'/en/product/test'})},
  '@/lib/cloudinary':cloudinary,'lucide-react':{Heart:()=>null},
 };
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]}});
 const product={slug:'test',name:'Test jacket',priceGBP:199,image:'https://res.cloudinary.com/demo/image/upload/front.webp',gallery:['https://res.cloudinary.com/demo/image/upload/front.webp','https://res.cloudinary.com/demo/image/upload/back.webp'],...overrides};
 return ()=>{cursor=0;return exports.ProductCard({p:product,priority})};
}
test('scrolling cards initially request only their main responsive photo without a repeated opacity reveal',()=>{
 const render=card(),tree=render(),photos=images(tree);
 assert.equal(tree.type,'article');assert.equal(photos.length,1);
 assert.equal(photos[0].props.loading,'lazy');assert.ok(photos[0].props.srcSet);
 tree.props.onPointerEnter({pointerType:'touch'});
 tree.props.onFocusCapture({target:{matches:()=>false}});
 assert.equal(images(render()).length,1);
 const firstRow=images(card(true)())[0];assert.equal(firstRow.props.loading,'eager');assert.equal(firstRow.props.fetchPriority,'high');
});
test('mouse hover requests the alternate at low priority and the front stays visible until it loads',()=>{
 const render=card();render().props.onPointerEnter({pointerType:'mouse'});
 let photos=images(render());assert.equal(photos.length,2);assert.equal(photos[1].props.fetchPriority,'low');assert.equal(photos[1].props.loading,'eager');
 assert.ok(!photos[0].props.className.includes('group-hover:opacity-0'));
 photos[1].props.onLoad();photos=images(render());assert.ok(photos[0].props.className.includes('group-hover:opacity-0'));
 photos[1].props.onError();photos=images(render());assert.ok(!photos[0].props.className.includes('group-hover:opacity-0'));assert.ok(!photos[1].props.className.includes('group-hover:opacity-100'));
});
test('keyboard focus can request alternate photos without requiring a mouse',()=>{
 const render=card();render().props.onFocusCapture({target:{matches:()=>true}});assert.equal(images(render()).length,2);
});


test('bag cards normalize studio margins into an equal white canvas for front and hover views',()=>{
 const render=card(false,{category:'leather-bags',image:'https://res.cloudinary.com/demo/image/upload/bag-01.png',gallery:['https://res.cloudinary.com/demo/image/upload/bag-01.png','https://res.cloudinary.com/demo/image/upload/bag-02.png']});
 let photos=images(render());
 assert.match(photos[0].props.src,/e_trim:10\/c_fit,w_588,h_735\/c_lpad,w_700,h_875,b_white,g_center/);
 assert.ok(photos[0].props.className.includes('object-contain'));
 assert.match(photos[0].props.srcSet,/c_lpad,w_360,h_450,b_white,g_center/);
 render().props.onPointerEnter({pointerType:'mouse'});photos=images(render());
 assert.match(photos[1].props.src,/e_trim:10\/c_fit,w_588,h_735\/c_lpad,w_700,h_875,b_white,g_center/);
 const legacy=cloudinary.bagImageUrl('https://res.cloudinary.com/demo/image/upload/older.webp',700,875);
 assert.ok(!legacy.includes('e_trim'));assert.ok(legacy.includes('c_lpad,w_700,h_875,b_white,g_center'));
});
