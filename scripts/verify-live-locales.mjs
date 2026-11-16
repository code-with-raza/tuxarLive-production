import fs from 'node:fs/promises';
import { inspectPublicHtml } from './verify-public-locale-html.mjs';
const after = process.argv.includes('--after-deployment');
const urls = [...(await fs.readFile('public/sitemap.xml','utf8')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
const locales=['en','de','es','fr','it'];
const output=`output/multilingual-audit-20261028/${after?'live-after-deployment':'live-before-deployment'}`;
await fs.mkdir(output,{recursive:true});
const results=[];
async function check(url){
 const result={url};
 try{
  if(new URL(url).origin!=='https://tuxar.co.uk'||!urls.includes(url))throw Error('Not an audited public URL');
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  result.status=response.status;result.location=response.headers.get('location');
  if(response.status!==200)throw Error(`HTTP ${response.status}`);
  if(/noindex/i.test(response.headers.get('x-robots-tag')??''))throw Error('HTTP noindex header');
  const html=await response.text();
  const inspected=inspectPublicHtml(html,url);
  result.locale=inspected.locale;result.title=inspected.title;result.h1=inspected.h1;result.alternates=inspected.alternates;result.pass=true;
 }catch(error){result.pass=false;result.error=error.message;}
 results.push(result);return result;
}
const probes=locales.flatMap(locale=>[`https://tuxar.co.uk/${locale}`,urls.find(url=>url.startsWith(`https://tuxar.co.uk/${locale}/product/`)&&url.includes(locale==='en'?'/product/womens-':'/product/'))]);
for(const url of probes)await check(url);
const confirmed=results.every(row=>row.pass);
if(after&&confirmed){
 const rest=urls.filter(url=>!probes.includes(url));
 for(let index=0;index<rest.length;index+=4){
  await Promise.all(rest.slice(index,index+4).map(check));
  if(index%100===0)console.log(`Live public pages checked: ${results.length}/${urls.length}`);
 }
 const byUrl=new Map(results.map(row=>[row.url,row]));
 for(const row of results.filter(row=>row.pass))for(const target of Object.values(row.alternates))if(byUrl.get(target)?.alternates?.[row.locale]!==row.url){row.pass=false;row.error='Live non-reciprocal hreflang';}
}
const report={phase:after?'after-deployment':'before-deployment sample',checkedAt:new Date().toISOString(),expectedPublicPages:urls.length,deploymentConfirmedByHtml:confirmed,fullCrawlCompleted:after&&confirmed&&results.length===urls.length,failures:results.filter(row=>!row.pass).length,results,method:'Public GET only; no authentication, cookies, cart actions, payment sessions or remote writes.'};
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
await fs.writeFile(`${output}/RESULTS.md`,['# Live multilingual HTTP/HTML audit','',`Phase: ${report.phase}`,`Full crawl completed: ${report.fullCrawlCompleted}`,`Failures: ${report.failures}`,'','| URL | HTTP | Result |','| --- | --- | --- |',...results.map(row=>`| ${row.url} | ${row.status??'Network error'} | ${row.pass?'Self canonical, correct lang, six alternates, one H1, indexable':row.error} |`)].join('\n')+'\n');
console.log(JSON.stringify({output,fullCrawlCompleted:report.fullCrawlCompleted,failures:report.failures,requests:results.length}));
if(after&&(!report.fullCrawlCompleted||report.failures))process.exitCode=1;
