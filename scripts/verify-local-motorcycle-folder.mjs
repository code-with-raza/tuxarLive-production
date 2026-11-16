import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const catalogue=JSON.parse(await fs.readFile('src/data/products/local-jackets.json','utf8'));
const images=JSON.parse(await fs.readFile('output/motorcycle-jackets-folder-01/image-map.json','utf8'));
const results=[];
for(const target of ['/en/shop','/en/collections/motorcycle-jackets',...catalogue.products.map(p=>'/en/product/'+p.slug),...images.map(image=>image.path)]){
 const response=await fetch('http://127.0.0.1:5174'+target,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 results.push({path:target,status:response.status,contentType:response.headers.get('content-type')});
 if(response.status!==200)throw new Error(`Local HTTP failure: ${target}`);
 if(target.endsWith('.webp')&&!response.headers.get('content-type')?.includes('image/webp'))throw new Error(`Image returned the wrong content type: ${target}`);
 await response.arrayBuffer();
}
for(const image of images)if(createHash('sha256').update(await fs.readFile(image.source)).digest('hex')!==image.sourceSHA256)throw new Error('Original image changed');
const built=[];
for(const name of await fs.readdir('dist/assets'))if(/\.js$/.test(name))built.push(await fs.readFile('dist/assets/'+name,'utf8'));
for(const p of catalogue.products)if(built.some(text=>text.includes(p.slug)))throw new Error('Draft leaked into production JavaScript');
const sitemap=await fs.readFile('dist/sitemap.xml','utf8');
for(const p of catalogue.products)if(sitemap.includes(p.slug))throw new Error('Draft leaked into sitemap');
const report={results,httpChecks:results.length,originalImageHashesUnchanged:true,productionDraftSlugMatches:0,sitemapDraftMatches:0,renderedBrowserCheck:'NOT COMPLETED: browser webview failed to attach; raw Vite responses are not DOM verification'};
await fs.writeFile('output/motorcycle-jackets-folder-01/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({httpChecks:results.length,images:images.length,originalImageHashesUnchanged:true,productionDraftSlugMatches:0,sitemapDraftMatches:0}));
