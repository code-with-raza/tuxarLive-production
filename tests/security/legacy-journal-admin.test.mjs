import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const source=await fs.readFile('src/components/admin/AdminJournal.tsx','utf8');
const article={slug:'legacy-guide',locale:'en',title:'Legacy guide',date:'2026-06-11',excerpt:'Saved excerpt',contentMarkdown:'# Body',category:'Guide',author:'Tuxar',image:'/blog_images/italian-leather.webp',seo:{}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({hidden=false,saveError=false}={}) {
  let cursor=0,loaded=false;
  const state=[],effects=[],writes=[],errors=[],success=[],locations=[];
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=value]},useCallback(fn){return fn},useEffect(fn){if(!loaded)effects.push(fn)}};
  const client={from(table){
    if(table==='blog_publication_states')return {select:async()=>({data:[{locale:'en',slug:article.slug,is_published:!hidden}]})};
    const chain={select(){return chain},order:async()=>({data:[]}),insert(values){writes.push(values);return chain},single:async()=>saveError?{error:{message:'Write denied'}}:{data:{id:'stored-id'}}};
    return chain;
  }};
  const modules={'react':react,'react/jsx-runtime':jsx,'lucide-react':{},'sonner':{toast:{error:message=>errors.push(message),success:message=>success.push(message)}},'@/lib/supabase':{supabase:client},'@/lib/blog':{getAllPosts:()=>[article]},'@/lib/blog/locale':{filterPostsByLocale:(posts,locale)=>posts.filter(post=>post.locale===locale)}};
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>modules[name],window:{location:{pathname:'/en/admin',assign:value=>locations.push(value)}},Map,Set,Date});
  const render=()=>{cursor=0;const tree=exports.AdminJournal();while(effects.length)effects.shift()();loaded=true;return tree};
  return {render,state,writes,errors,success,locations};
}
function find(node,text){if(!node||typeof node!=='object')return null;if(node.type==='button'&&[node.props.children].flat().includes(text))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,text);if(match)return match}return null}

test('built-in articles are editable without replaying a bulk import',async()=>{
  const app=setup();app.render();await settle();await settle();
  assert.equal(app.state[0].length,1);
  find(app.render(),'Edit').props.onClick();await settle();await settle();
  assert.equal(app.writes.length,1);
  assert.equal(app.writes[0].content_markdown,'# Body');
  assert.equal(app.writes[0].locale,'en');
  assert.equal(app.locations[0],'/en/admin/journal/stored-id');
});

test('archived legacy tombstones stay archived and a denied save never reports success or opens an editor',async()=>{
  const app=setup({hidden:true,saveError:true});app.render();await settle();await settle();
  assert.equal(app.state[0][0].status,'archived');
  find(app.render(),'Edit').props.onClick();await settle();await settle();
  assert.equal(app.writes[0].status,'archived');
  assert.equal(app.locations.length,0);
  assert.equal(app.success.length,0);
  assert.match(app.errors[0],/Write denied/);
});
