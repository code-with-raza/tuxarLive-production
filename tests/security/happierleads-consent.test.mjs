import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {parseCookiePreferences,essentialOnly} from '../../src/lib/cookie-preferences.ts';
const source=await fs.readFile('src/lib/happierleads.ts','utf8');
function storage(initial={}) {
 const values=new Map(Object.entries(initial));
 return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
function setup({path='/en',gpc=false,query=''}={}) {
 const scripts=[],redirects=[],cookies=[];
 const local=storage({'tuxar-cookie-consent':'off','tuxar-shop':'bag','hl_lead_id':'vendor','lastTimeSentToServer':'vendor'}),session=storage({'hl_rec_cfg':'vendor','hl_pcap_test':'vendor','customer-form':'keep'});
 const location={pathname:path,search:query,href:`https://tuxar.co.uk${path}${query}`,origin:'https://tuxar.co.uk',hostname:'tuxar.co.uk',replace:url=>redirects.push(url)};
 const document={createElement:()=>({attributes:{},setAttribute(name,value){this.attributes[name]=value}}),head:{appendChild(script){script.remove=()=>scripts.splice(scripts.indexOf(script),1);scripts.push(script)}},getElementById:id=>scripts.find(script=>script.id===id),set cookie(value){cookies.push(value)}};
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window:{location,localStorage:local,sessionStorage:session},document,navigator:{globalPrivacyControl:gpc},URL,URLSearchParams,Set});
 return {...exports,scripts,redirects,cookies,local,session,location};
}
test('legacy Analytics approval never opts a visitor into Marketing',()=>{
 assert.equal(parseCookiePreferences('accepted').analytics,true);
 assert.equal(parseCookiePreferences('accepted').marketing,false);
 assert.equal(parseCookiePreferences('rejected').marketing,false);
 for(const value of [null,'bad','{"version":2,"analytics":true,"marketing":"yes"}'])assert.equal(parseCookiePreferences(value),null);
 assert.deepEqual(essentialOnly(),{version:2,analytics:false,marketing:false});
});
test('no request before Marketing consent; one exact low-priority script survives public SPA navigation',()=>{
 const api=setup();api.startHappierleads(false);assert.equal(api.scripts.length,0);
 api.startHappierleads(true);
 for(const path of ['/en/shop','/en/product/example']){api.location.pathname=path;api.startHappierleads(true)}
 assert.equal(api.scripts.length,1);
 const script=api.scripts[0];
 assert.equal(script.src,'https://rest.happierleads.com/v3/script?clientId=jZ92NLWAxokKRSTZVgqhan');
 assert.equal(script.attributes['data-cfasync'],'false');assert.equal(script.fetchPriority,'low');assert.equal(script.defer,true);assert.equal(script.async,true);
});
test('GPC and private routes override a saved Marketing grant',()=>{
 const gpc=setup({gpc:true});gpc.startHappierleads(true);assert.equal(gpc.scripts.length,0);
 for(const path of ['/admin','/en/admin','/en/admin/journal/new','/fr/account','/en/checkout','/en/login','/en/reset-password','/en/confirmation']){
  const api=setup({path});api.startHappierleads(true);assert.equal(api.scripts.length,0,path);
 }
});
test('withdrawal removes vendor storage and reloads without clearing bag/auth preferences',()=>{
 const api=setup();api.startHappierleads(true);api.stopHappierleads(true);
 assert.equal(api.scripts.length,0);assert.equal(api.local.getItem('hl_lead_id'),null);assert.equal(api.local.getItem('lastTimeSentToServer'),null);
 assert.equal(api.session.getItem('hl_rec_cfg'),null);assert.equal(api.session.getItem('hl_pcap_test'),null);
 assert.equal(api.local.getItem('tuxar-shop'),'bag');assert.equal(api.session.getItem('customer-form'),'keep');assert.equal(api.local.getItem('tuxar-cookie-consent'),'off');
 assert.equal(api.redirects.length,1);assert.ok(api.cookies.some(cookie=>cookie.startsWith('hl_ad=; Max-Age=0')));
 api.startHappierleads(true);assert.equal(api.scripts.length,0);
});
test('failed preference persistence still reloads with a fail-closed opt-out',()=>{
 const api=setup();api.startHappierleads(true);api.stopHappierleads(false);
 assert.equal(new URL(api.redirects[0]).searchParams.get('tuxar_marketing_off'),'1');
 const next=setup({query:'?tuxar_marketing_off=1'});next.startHappierleads(true);assert.equal(next.scripts.length,0);
 assert.equal(new URL(next.trackingBoundaryUrl('/en/admin')).searchParams.get('tuxar_marketing_off'),'1');
});
test('server HTML contains no unconditional pixel and CSP adds only documented endpoints',async()=>{
 const html=await fs.readFile('index.html','utf8');assert.doesNotMatch(html,/happierleads/i);
 const rules=await fs.readFile('public/.htaccess','utf8');
 assert.match(rules,/script-src 'self' https:\/\/rest\.happierleads\.com/);
 for(const host of ['page-visits-full','tracking','session-recordings'])assert.ok(rules.includes(`https://${host}.happierleads.com`));
 assert.doesNotMatch(rules,/'unsafe-eval'|https:\/\/cdn\.jsdelivr\.net/);
});
