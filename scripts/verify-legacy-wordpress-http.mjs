import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
const argument=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const base=new URL(argument('--base-url')||'https://tuxar.co.uk');
const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
if(!local&&(base.origin!=='https://tuxar.co.uk'||!args.includes('--live-after-deployment')))throw new Error('Live cart-query checks require confirmed deployment and --live-after-deployment; no requests sent.');
const fixture=JSON.parse(await fs.readFile(new URL('../tests/fixtures/legacy-wordpress-soft404.json',import.meta.url),'utf8'));
const expectedPage=await fs.readFile(new URL('../public/legacy-not-found.html',import.meta.url),'utf8');
const hash=text=>createHash('sha256').update(text.replaceAll('\r\n','\n').trim()).digest('hex');
const rows=[];
async function check(target,status,options={}){
 const url=new URL(target,base);
 if(url.origin!==base.origin)throw new Error('Cross-origin probe refused');
 try{
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Tuxar-read-only-legacy-verification/1.0'}});
  const body=await response.text();
  const result={url:url.href,expected:status,status:response.status,location:response.headers.get('location'),contentType:response.headers.get('content-type'),server:response.headers.get('server'),bodyMatches404Page:hash(body)===hash(expectedPage)};
  result.pass=response.status===status&&!result.location&&(!options.errorPage||result.bodyMatches404Page);
  rows.push(result);return result;
 }catch(error){const row={url:url.href,expected:status,error:error.message,pass:false};rows.push(row);return row;}
}
for(const old of fixture.urls){
 const parsed=new URL(old);
 const bare=await check(parsed.pathname,404,{errorPage:true});
 // Never probe a legacy cart query until its bare path returns our exact static 404.
 if(parsed.search){
  if(bare.pass)await check(parsed.pathname+parsed.search,404,{errorPage:true});
  else rows.push({url:new URL(parsed.pathname+parsed.search,base).href,pass:false,skipped:'Cart query not sent: bare URL has not proved the deployed static 404 handler.'});
 }
}
for(const target of ['/en/product/classic-button-trucker','/en/shop','/en/leather-jackets','/en/checkout','/robots.txt','/sitemap.xml'])await check(target,200);
const report={checkedAt:new Date().toISOString(),base:base.origin,target:local?'Local HTTP target; engine not inferred':'Deployed public HTTPS origin',results:rows,failures:rows.filter(row=>!row.pass).length};
if(argument('--output'))await fs.writeFile(argument('--output'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failures)process.exitCode=1;
