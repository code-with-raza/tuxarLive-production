import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out='output/indexing-audit-2026-10-21';
await fs.mkdir(out,{recursive:true});
const source='C:/Users/Ahmad/Downloads/tuxar.co.uk-Coverage-Drilldown-2026-10-17 (2).xlsx';
const sheets=JSON.parse(execFileSync('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['scripts/read-gsc-workbook.py',source],{encoding:'utf8'}));
if(!/Discovered\s*[-—–]\s*currently not indexed/i.test(JSON.stringify(sheets.Metadata)))throw new Error('Wrong Metadata issue');
const urls=[...new Set(sheets.Table.flatMap(row=>Object.values(row)).filter(v=>/^https:\/\/tuxar\.co\.uk\//.test(v)))];
if(urls.length!==202)throw new Error(`Expected 202 URLs, got ${urls.length}`);
await fs.writeFile(`${out}/workbook.json`,JSON.stringify({source,sha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),metadata:sheets.Metadata,urls},null,2));
console.log(JSON.stringify({confirmedIssue:sheets.Metadata,urls:urls.length,english:urls.filter(u=>new URL(u).pathname.startsWith('/en/')).length}));
const parseAttrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
const locations=xml=>[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
const resources={};
for(const name of ['robots.txt','sitemap.xml']){
 const r=await fetch(`https://tuxar.co.uk/${name}`,{signal:AbortSignal.timeout(25000)});
 const text=await r.text();await fs.writeFile(`${out}/live-${name}`,text);resources[name]={status:r.status,contentType:r.headers.get('content-type')};
}
const liveXML=await fs.readFile(`${out}/live-sitemap.xml`,'utf8');
const liveSitemap=locations(liveXML),localSitemap=locations(await fs.readFile('public/sitemap.xml','utf8'));
const targets=[...new Set([...urls,...liveSitemap])].sort((a,b)=>Number(!a.includes('/en/'))-Number(!b.includes('/en/')));
if(targets.some(u=>new URL(u).origin!=='https://tuxar.co.uk'||new URL(u).search))throw new Error('Unexpected audit target');
const rows=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<targets.length){const url=targets[cursor++],start=performance.now();try{
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'Tuxar-public-SEO-audit/1.0'}});
 const html=await r.text();const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>parseAttrs(m[0]));const meta=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>parseAttrs(m[0]));
 rows.push({url,status:r.status,location:r.headers.get('location'),xRobots:r.headers.get('x-robots-tag'),ms:Math.round(performance.now()-start),inReport:urls.includes(url),inLiveSitemap:liveSitemap.includes(url),inLocalSitemap:localSitemap.includes(url),title:html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]??null,description:meta.find(m=>m.name==='description')?.content??null,canonical:links.filter(l=>l.rel==='canonical').map(l=>l.href),robots:meta.filter(m=>['robots','googlebot'].includes(m.name)).map(m=>m.content),initialAnchorCount:[...html.matchAll(/<a\b[^>]*href=/gi)].length,bodyHash:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html)});
 }catch(e){rows.push({url,error:e.message,inReport:urls.includes(url),inLiveSitemap:liveSitemap.includes(url),inLocalSitemap:localSitemap.includes(url)});}if(rows.length%50===0)console.log(`${rows.length}/${targets.length} HTTP checks`);}}));
const groups=[...liveXML.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m=>({url:m[1].match(/<loc>(.*?)<\/loc>/)?.[1],alternates:[...m[1].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(a=>({locale:a[1],url:a[2]}))}));
const hreflangErrors=[];for(const g of groups)for(const a of g.alternates){const peer=groups.find(p=>p.url===a.url);if(!peer||!peer.alternates.some(x=>x.url===g.url))hreflangErrors.push({from:g.url,to:a.url});}
const report={checkedAt:new Date().toISOString(),resources,reportCount:urls.length,liveSitemapCount:liveSitemap.length,localSitemapCount:localSitemap.length,hreflangErrors,rows};
await fs.writeFile(`${out}/http.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({requested:rows.length,statuses:rows.reduce((o,r)=>(o[r.status??'error']=(o[r.status??'error']??0)+1,o),{}),liveSitemap:liveSitemap.length,localSitemap:localSitemap.length,hreflangErrors:hreflangErrors.length,distinctRawHTML:new Set(rows.map(r=>r.bodyHash)).size}));
