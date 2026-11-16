import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('production catalogue exposes approved Cloudinary products once and retains existing products',async()=>{
  const approved=JSON.parse(await fs.readFile('src/data/products/approved-catalogue.json','utf8'));
  assert.equal(approved.products.length,125);
  const women=JSON.parse(await fs.readFile('src/data/products/approved-womens-catalogue.json','utf8'));
  assert.equal(women.products.length,94);
  const bags=JSON.parse(await fs.readFile('src/data/products/approved-bags-catalogue.json','utf8'));
  assert.equal(bags.products.length,11);
  const paths=new Set();
  for(const p of approved.products){
    assert.equal(p.category,'leather-jackets');
    assert.equal(p.cataloguePreview,undefined);
    assert.deepEqual(p.sizes,['M','L','XL','XXL']);
    for(const url of p.gallery){assert.match(url,/^https:\/\/res\.cloudinary\.com\/rllwk4bi\/image\/upload\/[a-z0-9-]+\.webp$/);paths.add(url);}
  }
  assert.equal(paths.size,602);
  const source=await fs.readFile('src/data/products.ts','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const drafts of [[],approved.products]){
    const exports={};
    vm.runInNewContext(code,{exports,require:specifier=>{
      if(specifier==='./products/approved-catalogue.json')return {default:approved};
      if(specifier==='./products/approved-bags-catalogue.json')return {default:bags};
      if(specifier==='./products/approved-womens-catalogue.json')return {default:women};
      if(specifier==='@/lib/local-catalogue')return {LOCAL_JACKET_PRODUCTS:drafts};
      if(specifier==='./product-types')return {};
      const name=specifier.split('/').at(-1).toUpperCase();
      return {[name==='JACKETS'?'JACKET_PRODUCTS':name==='SUITS'?'SUIT_PRODUCTS':name==='BAGS'?'BAG_PRODUCTS':'ACCESSORY_PRODUCTS']:[{slug:`existing-${name}`} ]};
    }});
    assert.equal(exports.PRODUCTS.length,234);
    assert.equal(new Set(exports.PRODUCTS.map(p=>p.slug)).size,234);
  }
});
