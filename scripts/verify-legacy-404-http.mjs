import fs from 'node:fs/promises';
const args=process.argv.slice(2);
const argument=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const base=new URL(argument('--base-url')||'https://tuxar.co.uk');
const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
if(!local&&(base.origin!=='https://tuxar.co.uk'||!args.includes('--live-after-deployment')))throw new Error('Live checks require confirmed deployment and --live-after-deployment; no requests sent.');
const fixture=JSON.parse(await fs.readFile(new URL('../tests/fixtures/legacy-wordpress-404.json',import.meta.url),'utf8'));
const page=await fs.readFile(new URL('../public/legacy-not-found.html',import.meta.url),'utf8');
const normalize=text=>text.replaceAll('\r\n','\n').trim();
const results=[];
async function check(target,status){
 const url=new URL(target,base);
 if(url.origin!==base.origin)throw new Error('Cross-origin probe refused.');
 try{
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Tuxar-read-only-deployed-404-verification/1.0'}});
  const body=await response.text();
  const location=response.headers.get('location');
  const pass=response.status===status&&(status===301?location==='https://tuxar.co.uk/en/shop':!location)&&(status!==404||normalize(body)===normalize(page));
  const row={url:url.href,expected:status,status:response.status,location,contentType:response.headers.get('content-type'),server:response.headers.get('server'),pass};
  results.push(row);return row;
 }catch(error){const row={url:url.href,expected:status,error:error.message,pass:false};results.push(row);return row;}
}
// New-handler preflight: don't send obsolete cart actions to an unverified old deployment.
const preflight=await check('/product/spidi-tour-net-tex-black-motorcycle-jacket/',404);
const queryPreflight=await check('/?page_id=2777',404);
for(const target of fixture.paths){
 const parsed=new URL(target,base);
 if(parsed.searchParams.has('add-to-cart')&&(!preflight.pass||!queryPreflight.pass)){
  results.push({url:parsed.href,pass:false,skipped:'Cart query not sent: new static 404 handlers did not pass preflight.'});
  continue;
 }
 await check(target,target==='/shop/'?301:404);
}
for(const target of ['/en/shop','/en/product/classic-button-trucker','/en/leather-jackets','/en/collections/cafe-racer-jackets','/en/checkout','/robots.txt','/sitemap.xml'])await check(target,200);
// This query-free legacy shop probe is safe even when preflight fails.
await check('/shop',301);
if(preflight.pass&&queryPreflight.pass)await check('/shop/?add-to-cart=2689&attribute_pa_size=l',301);
const report={checkedAt:new Date().toISOString(),target:local?'Local HTTP target; native server engine not inferred':'Public deployed HTTPS site',results,failures:results.filter(row=>!row.pass).length};
if(argument('--output'))await fs.writeFile(argument('--output'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failures)process.exitCode=1;
