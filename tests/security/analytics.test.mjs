import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

async function analytics(id='G-01ZC9ZLJ8Y') {
  const source=(await fs.readFile('src/lib/analytics.ts','utf8')).replace('import.meta.env.VITE_GA_MEASUREMENT_ID',JSON.stringify(id));
  const exports={},scripts=[];
  const window={location:{origin:'https://tuxar.co.uk'},localStorage:{getItem(){},setItem(){}}};
  const document={cookie:'',referrer:'https://example.com/',createElement(){return {remove(){scripts.splice(scripts.indexOf(this),1)}}},head:{appendChild(script){scripts.push(script)}}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window,document,URL});
  return {api:exports,window,scripts,commands:()=>window.dataLayer?.map(args=>Array.from(args))??[]};
}

test('GA4 stays blocked before Analytics consent and missing build configuration cannot load a tag',async()=>{
  for(const id of ['', 'G-01ZC9ZLJ8Y']) {
    const {api,scripts,commands}=await analytics(id);
    api.trackPageView('/en','Home');assert.equal(scripts.length,0);assert.equal(commands().length,0);
    if(!id){api.loadAnalytics();assert.equal(scripts.length,0)}
  }
});

test('consent loads one tag, queues one view per route and retains return visits',async()=>{
  const {api,scripts,commands}=await analytics();
  api.loadAnalytics();api.trackPageView('/en','Home');
  api.loadAnalytics();api.trackPageView('/en','Home');
  assert.equal(scripts.length,1);assert.match(scripts[0].src,/id=G-01ZC9ZLJ8Y$/);
  assert.equal(commands().filter(c=>c[0]==='config').length,1);
  assert.equal(commands().find(c=>c[0]==='config')[2].send_page_view,false);
  scripts[0].onload();
  api.loadAnalytics();api.trackPageView('/en/product/jacket','Jacket');api.trackPageView('/en/product/jacket','Jacket');
  const views=commands().filter(c=>c[1]==='page_view');
  assert.equal(views.length,2);
  assert.equal(views[1][2].send_to,'G-01ZC9ZLJ8Y');
  assert.equal(views[1][2].page_location,'https://tuxar.co.uk/en/product/jacket');
  assert.equal(views[1][2].page_referrer,'https://tuxar.co.uk/en');
  api.trackPageView('/en','Home');assert.equal(commands().filter(c=>c[1]==='page_view').length,3);
});

test('withdrawal stops events; a failed tag can retry without duplicate configuration or views',async()=>{
  const {api,window,scripts,commands}=await analytics();
  api.loadAnalytics();api.trackPageView('/en','Home');scripts[0].onerror();
  assert.equal(scripts.length,0);api.loadAnalytics();api.trackPageView('/en','Home');
  assert.equal(scripts.length,1);assert.equal(commands().filter(c=>c[0]==='config').length,1);
  assert.equal(commands().filter(c=>c[1]==='page_view').length,1);
  api.disableAnalytics();const before=commands().length;
  api.trackPageView('/en/product/jacket','Jacket');api.trackEvent('add_to_cart');
  assert.equal(commands().length,before);assert.equal(window['ga-disable-G-01ZC9ZLJ8Y'],true);
});
