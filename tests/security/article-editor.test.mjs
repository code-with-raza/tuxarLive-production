import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
function compile(source,modules={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},...globals});
  return exports;
}
const draft=compile(await fs.readFile('src/lib/article-draft.ts','utf8'));
const source=await fs.readFile('src/components/admin/AdminArticleEditor.tsx','utf8');
function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null;}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({id='new',cache=storage(),userId='staff-1',saveError=false,pendingSave=null}={}) {
  let cursor=0,authHandler,reads=0;
  const states=[],refs=[],deps=[],effects=[],cleanups=[],writes=[],navigations=[],errors=[],events=new Map();
  const react={
    useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}];},
    useRef(initial){const i=cursor++;return refs[i]??(refs[i]={current:initial});},
    useEffect(fn,next){const i=cursor++;if(!deps[i]||next.some((v,k)=>v!==deps[i][k])){deps[i]=next;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}
  };
  const existing={...draft.blankArticle('en','existing-id'),title:'Original',slug:'original',content_markdown:'Original body'};
  const supabase={auth:{getUser:async()=>({data:{user:{id:userId}}}),onAuthStateChange(callback){authHandler=callback;return {data:{subscription:{unsubscribe(){}}}};}},from(){let operation=null;const q={select(){return q},eq(){return q},insert(values){operation={action:'insert',values};writes.push(operation);return q},update(values){operation={action:'update',values};writes.push(operation);return q},async single(){if(operation){if(pendingSave)await pendingSave;if(saveError)return {error:new Error('Save failed')};return {data:{id:operation.values.id},error:null};}reads++;return {data:existing,error:null};}};return q;}};
  const media=()=>null,rich=()=>null;
  const {AdminArticleEditor}=compile(source,{'react':react,'react/jsx-runtime':jsx,'@tanstack/react-router':{useNavigate:()=>async value=>navigations.push(value)},'@/lib/supabase':{supabase},'@/lib/article-draft':draft,'@/components/admin/RichTextEditor':{RichTextEditor:rich},'@/components/admin/AdminMediaManager':{AdminMediaManager:media},sonner:{toast:{success(){},error:value=>errors.push(value)}}},{sessionStorage:cache,crypto:{randomUUID:()=> 'new-id'},window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}});
  const render=()=>{cursor=0;const tree=AdminArticleEditor({id,locale:'en'});while(effects.length)effects.shift()();return tree;};
  const input=(tree,name)=>find(tree,n=>n.type==='label'&&[n.props.children].flat().includes(name))?.props.children.find(n=>typeof n==='object');
  return {render,input,cache,writes,navigations,errors,events,rich,media,get reads(){return reads},auth(event,user=userId){authHandler(event,user?{user:{id:user}}:null)},dispose(){cleanups.forEach(fn=>fn?.());}};
}

test('new articles use a complete dedicated editor, insert only on Save and continue at the saved URL',async()=>{
  const app=setup();app.render();await settle();let tree=app.render();
  for(const name of ['Article title','URL slug','Category','Author','SEO title','SEO description','Featured image URL','Image alternative text'])assert.ok(app.input(tree,name),name);
  assert.equal(app.writes.length,0);
  app.input(tree,'Article title').props.onChange({target:{value:'My new article'}});tree=app.render();
  app.input(tree,'URL slug').props.onChange({target:{value:'my-new-article'}});tree=app.render();
  find(tree,n=>n.type===app.rich).props.onChange('<h2>Hello</h2><p>Article body</p>');tree=app.render();
  find(tree,n=>n.type===app.media).props.onUploaded({id:'media-1',secure_url:'https://example.com/cover.jpg',alt_text:'Cover'});tree=app.render();
  assert.equal(app.writes.length,0,'Uploading/selecting an image must not publish or save the post');
  await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(app.writes.length,1);assert.equal(app.writes[0].action,'insert');assert.equal(app.writes[0].values.status,'draft');assert.equal(app.writes[0].values.cover_image_url,'https://example.com/cover.jpg');
  assert.equal(app.navigations[0].params.id,'new-id');assert.equal(app.navigations[0].replace,true);
});

test('tab focus and same-user auth renewal preserve edits without loading or navigating to Journal',async()=>{
  const app=setup({id:'existing-id'});app.render();await settle();let tree=app.render();assert.equal(app.reads,1);
  app.input(tree,'Article title').props.onChange({target:{value:'Still writing'}});tree=app.render();
  find(tree,n=>n.type===app.rich).props.onChange('<p>Unsaved content</p>');
  app.auth('SIGNED_IN');app.auth('TOKEN_REFRESHED');app.events.get('focus')?.();tree=app.render();
  assert.equal(app.input(tree,'Article title').props.value,'Still writing');assert.equal(find(tree,n=>n.type===app.rich).props.value,'<p>Unsaved content</p>');assert.equal(app.reads,1);assert.equal(app.navigations.length,0);
  let warned=false;app.events.get('beforeunload')({preventDefault(){warned=true}});assert.equal(warned,true);
  app.auth('SIGNED_OUT',null);tree=app.render();assert.equal(find(tree,n=>n.type==='form'),null);
});

test('failed saves retain all edits and a remounted editor restores the same user draft',async()=>{
  const app=setup({id:'existing-id',saveError:true});app.render();await settle();let tree=app.render();
  app.input(tree,'Article title').props.onChange({target:{value:'Recovered title'}});tree=app.render();
  await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(app.errors.length,1);assert.equal(app.navigations.length,0);app.dispose();
  const restored=setup({id:'existing-id',cache:app.cache});restored.render();await settle();tree=restored.render();assert.equal(restored.input(tree,'Article title').props.value,'Recovered title');assert.equal(restored.reads,0);
  const other=setup({id:'existing-id',cache:app.cache,userId:'staff-2'});other.render();await settle();tree=other.render();assert.equal(other.input(tree,'Article title').props.value,'Original');
});

test('typing during an in-flight Save is recovered at the saved route rather than overwritten',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve});const app=setup({pendingSave:pending});app.render();await settle();let tree=app.render();
  app.input(tree,'Article title').props.onChange({target:{value:'Before save'}});tree=app.render();app.input(tree,'URL slug').props.onChange({target:{value:'before-save'}});tree=app.render();find(tree,n=>n.type===app.rich).props.onChange('<p>Content</p>');tree=app.render();
  const saving=find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});tree=app.render();app.input(tree,'Article title').props.onChange({target:{value:'Typed while saving'}});release();await saving;
  const recovered=draft.readArticleDraft(app.cache,draft.articleDraftKey('staff-1','en','new-id'));assert.equal(recovered.post.title,'Typed while saving');assert.equal(recovered.persisted,true);assert.equal(app.cache.getItem(draft.articleDraftKey('staff-1','en','new')),null);
});

test('draft recovery rejects corrupt data and handles browser storage failures',()=>{
  assert.equal(draft.readArticleDraft({getItem:()=>'{broken'},'key'),null);
  assert.equal(draft.readArticleDraft({getItem:()=>JSON.stringify({post:{id:'x'},persisted:false})},'key'),null);
  assert.equal(draft.writeArticleDraft({setItem(){throw new Error('quota')}},'key',draft.blankArticle('en','x'),false),false);
});

test('New article opens its dedicated URL instead of toggling an inline form',async()=>{
  let destination='';
  const {AdminJournal}=compile(await fs.readFile('src/components/admin/AdminJournal.tsx','utf8'),{
    react:{useState:initial=>[initial,()=>{}],useCallback:fn=>fn,useEffect(){}},'react/jsx-runtime':jsx,
  },{window:{location:{pathname:'/fr/admin',assign:value=>{destination=value}}}});
  const tree=AdminJournal();
  const button=find(tree,n=>n.type==='button'&&[n.props.children].flat().some(value=>typeof value==='string'&&value.includes('New article')));
  assert.ok(button);button.props.onClick();assert.equal(destination,'/fr/admin/journal/new');assert.equal(find(tree,n=>n.type==='form'),null);
});

test('signing out during a pending Save cannot reopen private content or navigate',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve});const app=setup({id:'existing-id',pendingSave:pending});app.render();await settle();const tree=app.render();
  const saving=find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});app.auth('SIGNED_OUT',null);release();await saving;
  assert.equal(app.navigations.length,0);assert.equal(find(app.render(),n=>n.type==='form'),null);
});

test('formatting survives sanitization while unsafe pasted content is removed',async()=>{
  const {sanitizeRichHtml}=compile(await fs.readFile('src/lib/sanitize.ts','utf8'),{'sanitize-html':{default:require('sanitize-html')}});
  const safe=sanitizeRichHtml('<h2>Heading</h2><p style="text-align:center"><font face="Georgia" style="font-size:24px"><u>Underlined</u></font><span style="background-color:#fff59d;font-weight:bold;font-style:italic;text-decoration:line-through">Formatted</span><sub>2</sub><sup>3</sup></p><script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">Unsafe</a>');
  for(const value of ['<h2>','font-size:24px','<u>','background-color:#fff59d','text-align:center','<sub>','<sup>'])assert.ok(safe.includes(value),value);
  assert.ok(!/script|onclick|javascript/.test(safe));
});
