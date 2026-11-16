import fs from 'node:fs/promises';
import path from 'node:path';

let pages=0,images=0;
async function walk(folder){
 for(const item of await fs.readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,item.name);
  if(item.isDirectory()){await walk(file);continue;}
  if(/\.(webp|png|jpe?g|avif|gif)$/i.test(item.name))throw Error('Local content image remains: '+file);
  if(!item.name.endsWith('.html'))continue;
  pages++;
  const html=await fs.readFile(file,'utf8');
  for(const tag of html.matchAll(/<img\b[^>]*>/gi)){
   const src=tag[0].match(/\bsrc="([^"]+)"/i)?.[1];
   if(!src||new URL(src).origin!=='https://res.cloudinary.com')throw Error('Non-Cloudinary photo in '+file+': '+src);
   images++;
  }
 }
}
await walk('dist');
if(images===0||pages<1490)throw Error('Expected complete rendered public site');
const report={pages,imageReferences:images,localContentImages:0,contentImageHost:'res.cloudinary.com',localSiteIcon:'favicon.svg'};
await fs.writeFile('output/cloudinary-only-build-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
