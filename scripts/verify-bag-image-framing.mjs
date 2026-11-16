import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { bagImageUrl } from '../src/lib/cloudinary.ts';
import ts from 'typescript';
import vm from 'node:vm';
const sharp=createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const products=JSON.parse(await fs.readFile('src/data/products/approved-bags-catalogue.json','utf8')).products;
const manifest=JSON.parse(await fs.readFile('src/data/cloudinary-assets.json','utf8'));
const legacy={};
vm.runInNewContext(ts.transpileModule(await fs.readFile('src/data/products/bags.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:legacy,require:()=>({getProductAsset:source=>manifest[source]?.url??source})});
products.push(...legacy.BAG_PRODUCTS);
const result=[];
for(const product of products){
 const url=bagImageUrl(product.image,700,875);
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`${product.slug}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 const meta=await sharp(bytes).metadata();
 if(meta.width!==700||meta.height!==875)throw Error(`${product.slug}: ${meta.width}x${meta.height}`);
 const pixel=await sharp(bytes).removeAlpha().extract({left:0,top:0,width:1,height:1}).raw().toBuffer();
 if(![...pixel].every(c=>c>=250))throw Error(`${product.slug}: non-white canvas`);
 result.push({slug:product.slug,url,width:meta.width,height:meta.height,status:response.status,whiteCanvas:true});
}
await fs.writeFile('output/bag-image-framing-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(`Verified all ${result.length} bag covers: 700x875, white canvas, HTTP 200.`);
