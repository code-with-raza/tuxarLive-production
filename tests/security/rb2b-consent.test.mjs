import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=await fs.readFile('src/lib/rb2b.ts','utf8');
function setup({gpc=false,path='/en',optOut=false}={}) {
 const scripts=[],cookies=[],timers=[];
 const values=new Map([['_reb2buid','vendor'],['_reb2sessionID','vendor'],['tuxar-shop','keep']]);
 const storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,removeItem:key=>values.delete(key)};
 const window={location:{pathname:path,hostname:'tuxar.co.uk'},localStorage:storage,sessionStorage:storage};
 const document={createElement:()=>({}),head:{appendChild(script){script.remove=()=>scripts.splice(scripts.indexOf(script),1);scripts.push(script)}},getElementById:id=>scripts.find(s=>s.id===id),set cookie(value){cookies.push(value)}};
 const exports={};
 const require=()=>({globalPrivacyControl:()=>gpc,marketingOptedOut:()=>optOut,publicTrackingPath:path=>!/^\/en\/(admin|account|checkout)/.test(path)});
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,window,document,Set,setTimeout:callback=>timers.push(callback)});
 return {...exports,scripts,cookies,values,window,timers};
}
test('RB2B uses the supplied URL once, only after Marketing permission',()=>{
 const api=setup();api.startRB2B(false);assert.equal(api.scripts.length,0);
 api.startRB2B(true);api.window.location.pathname='/en/shop';api.startRB2B(true);
 assert.equal(api.scripts.length,1);assert.equal(api.window.reb2b.loaded,true);
 assert.equal(api.scripts[0].src,'https://ddwl4m2hdecbv.cloudfront.net/b/4N210HX0KG6Z/4N210HX0KG6Z.js.gz');
 assert.equal(api.scripts[0].async,true);assert.equal(api.scripts[0].fetchPriority,'low');
});
test('GPC, opt-out and private routes block RB2B',()=>{
 for(const options of [{gpc:true},{optOut:true},{path:'/en/admin'},{path:'/en/account'},{path:'/en/checkout'}]){
  const api=setup(options);api.startRB2B(true);assert.equal(api.scripts.length,0);
 }
});
test('RB2B cleanup removes vendor state and preserves shop data',()=>{
 const api=setup();api.startRB2B(true);api.clearRB2B();
 assert.equal(api.scripts.length,0);assert.equal(api.values.has('_reb2buid'),false);assert.equal(api.values.has('_reb2sessionID'),false);
 assert.equal(api.values.get('tuxar-shop'),'keep');assert.ok(api.cookies.some(value=>value.startsWith('_reb2buid=; Max-Age=0')));
});

test('rb2b retries a failed download once without duplicate scripts or losing consent guards',()=>{
 const api=setup();api.startRB2B(true);const failed=api.scripts[0];failed.onerror();
 assert.equal(api.scripts.length,0);assert.equal(api.timers.length,1);
 api.timers.shift()();assert.equal(api.scripts.length,1);
 api.startRB2B(true);assert.equal(api.scripts.length,1);
 api.scripts[0].onerror();assert.equal(api.scripts.length,0);assert.equal(api.timers.length,0,'automatic retries are bounded');
 api.startRB2B(true);assert.equal(api.scripts.length,1,'a later public navigation can recover');
 const declined=setup();declined.startRB2B(true);declined.scripts[0].onerror();declined.startRB2B(false);declined.timers.shift()();assert.equal(declined.scripts.length,0);
 const privatePage=setup();privatePage.startRB2B(true);privatePage.scripts[0].onerror();privatePage.window.location.pathname='/en/account';privatePage.timers.shift()();assert.equal(privatePage.scripts.length,0);
});

test('failed RB2B bootstrap clears only its own loaded marker',()=>{
 const api=setup();api.startRB2B(true);api.scripts[0].onerror();assert.equal(api.window.reb2b,undefined);
 const other=setup();other.startRB2B(true);const existing={loaded:true,otherOwner:true};other.window.reb2b=existing;other.scripts[0].onerror();assert.equal(other.window.reb2b,existing);other.timers.shift()();assert.equal(other.scripts.length,0);
});
