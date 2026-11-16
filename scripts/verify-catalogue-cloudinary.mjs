import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const catalogue=JSON.parse(await fs.readFile('src/data/products/local-jackets.json','utf8'));
const paths=[...new Set(catalogue.products.flatMap(p=>p.gallery))];
const results=[];
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{
  while(cursor<paths.length){
    const localPath=paths[cursor++];
    const url=`https://res.cloudinary.com/rllwk4bi/image/upload/${path.posix.basename(localPath)}`;
    let result;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Not an image');
        const remote=Buffer.from(await response.arrayBuffer());
        const local=await fs.readFile(localPath.slice(1));
        const hash=b=>createHash('sha256').update(b).digest('hex');
        if(hash(remote)!==hash(local))throw new Error('Image bytes differ from approved local image');
        result={localPath,url,verified:true,sha256:hash(remote)};break;
      }catch(error){result={localPath,url,verified:false,error:error.message};}
    }
    results.push(result);
    if(results.length%50===0)console.log(`${results.length}/${paths.length} checked`);
  }
}));
results.sort((a,b)=>a.localPath.localeCompare(b.localPath));
await fs.mkdir('output/catalogue-publication',{recursive:true});
await fs.writeFile('output/catalogue-publication/cloudinary-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(JSON.stringify({images:results.length,verified:results.filter(r=>r.verified).length,failed:results.filter(r=>!r.verified).length}));
if(results.some(r=>!r.verified))process.exitCode=1;
