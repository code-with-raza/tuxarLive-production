import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const manifest=JSON.parse(await fs.readFile('src/data/cloudinary-assets.json','utf8'));
const targets=[
 ['/src/assets/products/classic/zip4.webp','src/assets/products/classic/zip4.webp'],
 ...['cognac_leather','italian-leather','winter'].map(name=>['/blog_images/'+name+'.webp','public/blog_images/'+name+'.webp']),
];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const report=[];
for(const [key,local]of targets){
 const original=await fs.readFile(local);
 const pixels=await sharp(original).ensureAlpha().raw().toBuffer();
 const candidates=[manifest[key].url,...(key.includes('zip4')?['https://res.cloudinary.com/rllwk4bi/image/upload/classic-zip4.webp']:[])];
 for(const url of candidates){
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  const entry={key,url,status:response.status,pixelMatch:false};
  if(response.ok){const bytes=Buffer.from(await response.arrayBuffer());entry.pixelMatch=digest(await sharp(bytes).ensureAlpha().raw().toBuffer())===digest(pixels);entry.remoteBytes=bytes.length;}
  report.push(entry);
 }
}
await fs.writeFile('output/remaining-hosted-images-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
