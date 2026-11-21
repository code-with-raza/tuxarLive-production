import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { normalizeArticleBody } from '../../src/lib/blog/article-body.ts';

const source=await fs.readFile('src/lib/blog/published.ts','utf8');
function setup({rows=[],bundled=[],states=[],languages=[],maps={},configured=true,error=null}={}) {
  const exports={}, calls=[];
  const client={from(table){
    if(table==='blog_publication_states') {
      const stateChain={select(){return stateChain},eq(){return stateChain},in(){return stateChain},abortSignal(){return Promise.resolve({data:states,error})}};
      return stateChain;
    }
    const query={table,filters:{}};calls.push(query);
    const chain={select(fields){query.fields=fields;return chain},eq(key,value){query.filters[key]=value;return chain},or(value){query.group=value;return chain},order(){return chain},range(start,end){query.start=start;query.end=end;return chain},abortSignal(){return Promise.resolve({data:query.group?languages:rows.slice(query.start,query.end+1),error})}};
    return chain;
  }};
  const modules={
    '../supabase':{publicSupabase:client,isSupabaseConfigured:()=>configured},
    './content':{getAllPostsFromMarkdown:()=>bundled},
    './locale':{filterPostsByLocale:(posts,locale)=>posts.filter(p=>p.locale===locale)},
    './markdown':{calculateReadMinutes:()=>3,markdownToHtml:body=>`<p>${body}</p>`},
    '@/assets':{getProductAsset:path=>path},
    '@/i18n/i18n':{BLOG_SLUG_MAP:maps},
    './article-body':{normalizeArticleBody},
  };
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>modules[name],AbortSignal,Map,Date});
  return {...exports,calls};
}
const article=(extra={})=>({id:'live-1',locale:'en',slug:'new-motorcycle-guide',title:'New guide',excerpt:'New excerpt',content_markdown:'Body',category:'Journal',author:'Tuxar',cover_image_url:'https://res.cloudinary.com/test/image/upload/cover.webp',cover_image_alt:'Cover',seo_title:'Guide SEO',seo_description:'Description',status:'published',published_at:'2026-11-21T00:00:00Z',...extra});

test('pasted duplicate titles are removed and body headings retain a semantic hierarchy',()=>{
  const body=normalizeArticleBody('<h1><span style="font-family:Arial">Leather &amp; Bags</span></h1><h2>Buying guide</h2><h3>Fit</h3>','Leather & Bags');
  assert.equal(body,'<h2>Buying guide</h2><h3>Fit</h3>');
  assert.equal(normalizeArticleBody('<h1>Different section</h1><p>Text</p>','Article title'),'<h2>Different section</h2><p>Text</p>');
});

test('new CMS articles appear without a bundled slug and retain saved content and metadata',async()=>{
  const api=setup({rows:[article()]});
  const posts=await api.getPublishedPosts('en');
  assert.equal(posts.length,1);
  assert.equal(posts[0].slug,'new-motorcycle-guide');
  assert.equal(posts[0].contentHtml,'<p>Body</p>');
  assert.equal(posts[0].seo.metaTitle,'Guide SEO');
  assert.equal(posts[0].image,article().cover_image_url);
  assert.equal((await api.getPublishedPost('new-motorcycle-guide','en')).id,'live-1');
  assert.deepEqual(api.calls[0].filters,{status:'published',locale:'en'});
});

test('reviewed translated handles link to the same published source without advertising draft languages',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const api=setup({rows:[article({id})],languages:[{locale:'en',slug:'new-motorcycle-guide'},{locale:'fr',slug:'guide-moto'}]});
  const post=await api.getPublishedPost('new-motorcycle-guide','en');
  assert.equal(post.translations.fr,'guide-moto');
  assert.equal(post.translations.de,undefined);
  assert.deepEqual(api.calls.at(-1).filters,{status:'published'});
});

test('linked CMS articles preserve untouched bundled translations and suppress archived language versions',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const bundled=[{locale:'en',slug:'guide'},{locale:'fr',slug:'guide-fr'},{locale:'de',slug:'guide-de'}];
  const api=setup({rows:[article({id,slug:'guide'})],bundled,maps:{guide:{en:'guide',fr:'guide-fr',de:'guide-de'}},states:[{locale:'de',slug:'guide-de',is_published:false}],languages:[{locale:'en',slug:'guide'}]});
  const post=await api.getPublishedPost('guide','en');
  assert.equal(post.translations.fr,'guide-fr');
  assert.equal(post.translations.de,undefined);
});

test('draft, archived, deleted and renamed bundled articles cannot reappear through fallback',async()=>{
  const bundled=['draft','archived','deleted','old-slug','untouched'].map(slug=>({locale:'en',slug}));
  const states=bundled.slice(0,4).map(post=>({slug:post.slug,is_published:false}));
  const posts=await setup({bundled,states}).getPublishedPosts('en');
  assert.deepEqual(Array.from(posts,post=>post.slug),['untouched']);
});
test('public results exclude drafts, archives and other languages even if returned by a client',async()=>{
  const api=setup({rows:[article(),article({slug:'draft',status:'draft'}),article({slug:'archived',status:'archived'}),article({slug:'french',locale:'fr'})]});
  assert.equal((await api.getPublishedPosts('en')).length,1);
  assert.equal(await api.getPublishedPost('french','en'),undefined);
  assert.equal(await api.getPublishedPost('draft','en'),undefined);
});
test('live updates replace the bundled article and are read again on subsequent navigation',async()=>{
  const rows=[article()];
  const api=setup({rows,bundled:[{...article(),date:'2020-01-01',title:'Old bundled title'}]});
  assert.equal((await api.getPublishedPosts('en'))[0].title,'New guide');
  rows[0]=article({title:'Updated guide'});
  const posts=await api.getPublishedPosts('en');
  assert.equal(posts.length,1);
  assert.equal(posts[0].title,'Updated guide');
});
test('published results are paged and failures do not silently pretend the journal is current',async()=>{
  const api=setup({rows:Array.from({length:101},(_,i)=>article({id:String(i),slug:`guide-${i}`}))});
  assert.equal((await api.getPublishedPosts('en')).length,101);
  assert.equal(api.calls.length,2);
  await assert.rejects(setup({error:new Error('offline')}).getPublishedPosts('en'),/journal could not be loaded/);
  const local=setup({configured:false,bundled:[{locale:'en',slug:'original'}]});
  assert.equal((await local.getPublishedPosts('en'))[0].slug,'original');
  assert.equal(local.calls.length,0);
});
