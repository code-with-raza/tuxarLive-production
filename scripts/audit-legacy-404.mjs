import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const source=process.argv[2];
if(!source)throw new Error('Supply the directory containing Metadata.csv and Table.csv.');
const output='output/legacy-404-audit-2026-10-18';
const metadata=await fs.readFile(path.join(source,'Metadata.csv'),'utf8');
if(!/^Issue,Not found \(404\)\s*$/m.test(metadata))throw new Error('Wrong issue in Metadata.csv.');
const csv=await fs.readFile(path.join(source,'Table.csv'),'utf8');
// The inspected export has two unquoted fields per row. Reject other CSV shapes.
const lines=csv.trim().split(/\r?\n/);
if(lines.shift()!=='URL,Last crawled'||lines.length!==35||lines.some(line=>line.includes('"')||line.split(',').length!==2))throw new Error('Unexpected CSV shape.');
const urls=lines.map(line=>line.split(',')[0]);
if(new Set(urls).size!==35||urls.some(url=>new URL(url).origin!=='https://tuxar.co.uk'))throw new Error('Unexpected duplicate or origin.');
await fs.mkdir(output,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
await fs.writeFile(`${output}/source-extract.json`,JSON.stringify({issue:'Not found (404)',sourceDirectory:source,sha256:{metadata:hash(metadata),table:hash(csv)},rows:lines.map(line=>{const [url,lastCrawled]=line.split(',');return {url,lastCrawled};})},null,2));
const controls=['/en/shop','/en/product/classic-button-trucker','/en/leather-jackets','/en/collections/motorcycle-jackets','/en/collections/cafe-racer-jackets','/en/checkout','/en/blog/the-cognac-leather-jacket-guide','/robots.txt','/sitemap.xml'];
async function probe(original){
 const parsed=new URL(original,'https://tuxar.co.uk');
 const omitted=parsed.searchParams.has('add-to-cart');
 if(omitted)parsed.search='';
 try{
  const response=await fetch(parsed,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Tuxar-read-only-legacy-404-audit/1.0'}});
  const body=await response.text();
  const row={original,requested:parsed.href,cartQueryNotSent:omitted,status:response.status,location:response.headers.get('location'),contentType:response.headers.get('content-type'),server:response.headers.get('server'),bodySha256:hash(body)};
  if(parsed.pathname==='/sitemap.xml')await fs.writeFile(`${output}/live-sitemap.xml`,body);
  return row;
 }catch(error){return {original,requested:parsed.href,cartQueryNotSent:omitted,error:error.message};}
}
const results=[];
const targets=[...urls,...controls];
for(let i=0;i<targets.length;i+=4)results.push(...await Promise.all(targets.slice(i,i+4).map(probe)));
const report={checkedAt:new Date().toISOString(),deployedByThisTask:false,method:'GET, redirect manual; no cookies/auth; add-to-cart queries omitted',results};
await fs.writeFile(`${output}/live-before-deployment.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
