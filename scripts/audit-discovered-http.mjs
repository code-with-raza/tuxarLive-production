import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='output/discovered-indexing-2026-10-18';
const source=JSON.parse(await fs.readFile(`${out}/workbook-extract.json`,'utf8'));
const origin='https://tuxar.co.uk';
const resources={};
for(const file of ['robots.txt','sitemap.xml']){
 const response=await fetch(`${origin}/${file}`,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 const body=await response.text();
 resources[file]={status:response.status,contentType:response.headers.get('content-type'),location:response.headers.get('location')};
 await fs.writeFile(`${out}/live-${file}`,body);
}
const xml=await fs.readFile(`${out}/live-sitemap.xml`,'utf8');
const localXML=await fs.readFile('public/sitemap.xml','utf8');
const locations=text=>[...text.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1].replaceAll('&amp;','&'));
const sitemap=locations(xml),localSitemap=locations(localXML);
const urls=[...new Set([...source.urls,...sitemap])];
if(urls.some(url=>new URL(url).origin!==origin||new URL(url).search))throw new Error('Unexpected sitemap/report URL; inspect before requesting.');
const rows=[];
for(let i=0;i<urls.length;i+=4){
 rows.push(...await Promise.all(urls.slice(i,i+4).map(async url=>{
  const start=performance.now();
  try{
   const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Tuxar-read-only-indexing-audit/1.0'}});
   const headersMs=Math.round(performance.now()-start);
   const html=await response.text();
   return {url,inReport:source.urls.includes(url),inLiveSitemap:sitemap.includes(url),status:response.status,location:response.headers.get('location'),contentType:response.headers.get('content-type'),xRobotsTag:response.headers.get('x-robots-tag'),headersMs,totalMs:Math.round(performance.now()-start),bytes:Buffer.byteLength(html),bodySHA256:createHash('sha256').update(html).digest('hex'),initialCanonicals:[...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)].map(match=>match[0]),initialRobots:[...html.matchAll(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*>/gi)].map(match=>match[0]),initialTitle:html.match(/<title>(.*?)<\/title>/is)?.[1]??null,csp:response.headers.get('content-security-policy')};
  }catch(error){return {url,error:error.message,totalMs:Math.round(performance.now()-start)};}
 })));
}
const report={checkedAt:new Date().toISOString(),method:'Unauthenticated GET; redirects manual; bounded concurrency 4; not a Googlebot or historical availability test',resources,sourceURLCount:source.urls.length,sitemapURLCount:sitemap.length,reportMissingFromLiveSitemap:source.urls.filter(url=>!sitemap.includes(url)),liveNotLocal:sitemap.filter(url=>!localSitemap.includes(url)),localNotLive:localSitemap.filter(url=>!sitemap.includes(url)),results:rows};
await fs.writeFile(`${out}/live-http.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({checkedAt:report.checkedAt,requested:rows.length,sitemap:sitemap.length,statusCounts:rows.reduce((acc,row)=>{const key=row.status??'error';acc[key]=(acc[key]??0)+1;return acc;},{}),missingFromSitemap:report.reportMissingFromLiveSitemap,liveNotLocal:report.liveNotLocal,localNotLive:report.localNotLive,slowOver2000Ms:rows.filter(row=>row.headersMs>2000).map(row=>({url:row.url,headersMs:row.headersMs})),blockingHeaders:rows.filter(row=>row.xRobotsTag),distinctBodies:new Set(rows.map(row=>row.bodySHA256)).size},null,2));
