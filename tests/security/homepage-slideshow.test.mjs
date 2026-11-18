import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import * as cloudinary from '../../src/lib/cloudinary.ts';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
function compile(source,modules={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},URL,...globals});return exports;}
const read=(file,modules={},globals={})=>fs.readFile(file,'utf8').then(source=>compile(source,modules,globals));
const campaign=await read('src/lib/homepage-campaign.ts',{'./cloudinary':cloudinary});
const slideshow=await read('src/lib/homepage-slides.ts',{'./homepage-campaign':campaign});
const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null;};
const text=node=>typeof node==='string'?node:node&&typeof node==='object'?[node.props?.children].flat(Infinity).map(text).join(' '):'';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function hooks(){let cursor=0;const states=[],refs=[],deps=[],pending=[],cleanups=[];return {react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}];},useRef(initial){const i=cursor++;return refs[i]??(refs[i]={current:initial});},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(fn,next){const i=cursor++;if(!deps[i]||next.some((value,k)=>value!==deps[i][k])){deps[i]=next;pending.push(()=>{cleanups[i]?.();cleanups[i]=fn()});}}},render(fn){cursor=0;return fn();},flush(){while(pending.length)pending.shift()();},dispose(){cleanups.forEach(fn=>fn?.());}};}
const slide=(id,overrides={})=>({id,locale:'en',position:1,enabled:true,archived:false,image_url:`https://res.cloudinary.com/demo/image/upload/${id}.webp`,destination_url:'/en/shop',title:`Slide ${id}`,alt_text:`Image ${id}`,button_label:'Shop',eyebrow:'',subtitle:'',show_text:false,tone:'light',image_width:1920,image_height:1080,...overrides});

function bannerDatabase(initial){
 const rows=new Map(initial.map(row=>[row.id,{...row}])),writes=[];
 return {rows,writes,client:{from(table){assert.equal(table,'homepage_slides');let changes=null,filters=[];
  const selected=()=>[...rows.values()].filter(row=>filters.every(([key,value])=>row[key]===value));
  const q={select(){return q},eq(key,value){filters.push([key,value]);return q},order(key){return key==='id'?Promise.resolve({data:selected().map(row=>({...row})),error:null}):q},limit(){return Promise.resolve({data:selected().sort((a,b)=>b.position-a.position).slice(0,1),error:null})},async maybeSingle(){return {data:selected()[0]??null,error:null}},update(values){changes=values;return q},upsert(values){changes=values;return q},async single(){
   const target=changes?.id?rows.get(changes.id):selected()[0];
   if(!target&&!changes?.id)return {data:null,error:{message:'Not found'}};
   const saved={...target,...changes};rows.set(saved.id,saved);writes.push({changes,filters});return {data:{...saved},error:null};
  }};return q;
 }}};
}

test('all original and added banners open dedicated editor routes; draft and confirmed delete affect only their target',async()=>{
 const initial=[...Array.from({length:5},(_,i)=>slide('original-'+i,{legacy_locale:'builtin:en:'+i,position:i})),slide('added',{enabled:false,position:5})];
 const db=bannerDatabase(initial),h=hooks(),errors=[];
 const {AdminHomepageBanner}=await read('src/components/admin/AdminBanners.tsx',{
  react:h.react,'react/jsx-runtime':jsx,'@tanstack/react-router':{Link:'route-link'},'lucide-react':{},'@/i18n/i18n':{SUPPORTED_LOCALES:['en','fr']},'@/lib/supabase':{supabase:db.client},'@/lib/homepage-campaign':campaign,'@/lib/homepage-slides':slideshow,'@/lib/cloudinary':cloudinary,sonner:{toast:{success(){},error:value=>errors.push(value)}},
 });
 const render=()=>h.render(()=>AdminHomepageBanner());render();h.flush();await settle();let tree=render();
 const collect=(node,predicate,result=[])=>{if(node&&typeof node==='object'){if(predicate(node))result.push(node);for(const child of [node.props?.children].flat(Infinity))collect(child,predicate,result);}return result;};
 assert.equal(collect(tree,node=>node.type==='article').length,6);assert.equal(find(tree,node=>node.type==='form'),null);
 const add=find(tree,node=>node.type==='route-link'&&node.props.params.id==='new');assert.equal(add.props.to,'/$locale/admin/banners/$id');assert.equal(add.props.search.language,'en');
 const original=find(tree,node=>node.type==='article'&&text(node).includes('Slide original-0'));
 assert.equal(find(original,node=>node.type==='route-link').props.params.id,'original-0');
 find(original,node=>node.type==='button'&&text(node)==='Move to draft').props.onClick();await settle();tree=render();
 assert.equal(db.rows.get('original-0').enabled,false);assert.equal(db.rows.get('original-1').enabled,true);
 assert.ok(!slideshow.publishedHomepageSlides([...db.rows.values()],'en').some(row=>row.id==='original-0'));
 const draft=find(tree,node=>node.type==='article'&&text(node).includes('Slide original-0'));
 find(draft,node=>node.type==='button'&&text(node)==='Publish').props.onClick();await settle();tree=render();assert.equal(db.rows.get('original-0').enabled,true);
 const first=find(tree,node=>node.type==='article'&&text(node).includes('Slide original-0'));
 const writesBefore=db.writes.length;find(first,node=>node.type==='button'&&text(node).trim()==='Delete').props.onClick();tree=render();
 assert.equal(db.writes.length,writesBefore,'Delete must wait for confirmation');
 find(tree,node=>node.type==='button'&&text(node)==='Keep banner').props.onClick();tree=render();assert.equal(db.writes.length,writesBefore);
 find(first,node=>node.type==='button'&&text(node).trim()==='Delete').props.onClick();tree=render();find(tree,node=>node.type==='button'&&text(node)==='Delete banner').props.onClick();await settle();tree=render();
 assert.equal(db.rows.get('original-0').archived,true);assert.equal(db.rows.get('original-0').enabled,false);assert.equal(collect(tree,node=>node.type==='article').length,5);
 assert.equal(db.rows.get('added').archived,false);assert.equal(errors.length,0);
 assert.ok(db.writes.every(write=>write.filters.some(([key])=>key==='locale')));
});

test('the dedicated banner editor creates drafts and can save a published original back to draft without losing its import key',async()=>{
 for(const existing of [false,true]){
  const row=slide('stored',{legacy_locale:'builtin:en:main'}),db=bannerDatabase(existing?[row]:[]),h=hooks(),navigations=[],errors=[];
  const {AdminBannerEditor}=await read('src/components/admin/AdminBannerEditor.tsx',{
   react:h.react,'react/jsx-runtime':jsx,'@tanstack/react-router':{useNavigate:()=>value=>navigations.push(value)},'@/lib/supabase':{supabase:db.client},'@/lib/homepage-campaign':campaign,'@/lib/homepage-slides':slideshow,'@/lib/storefront-products':{getStorefrontProducts:async()=>[]},'@/lib/banner-destinations':{bannerDestinations:()=>[]},'@/components/admin/AdminMediaManager':{AdminMediaManager:'image-picker'},sonner:{toast:{success(){},error:value=>errors.push(value)}},
  },{crypto:{randomUUID:()=> 'new-banner'},window:{setTimeout:()=>1,clearTimeout(){}},Image:class{naturalWidth=2172;naturalHeight=724;set src(value){this.onload?.();}}});
  const render=()=>h.render(()=>AdminBannerEditor({id:existing?'stored':'new',locale:'en',uiLocale:'en'}));render();h.flush();await settle();let tree=render();
  const status=()=>find(tree,node=>node.type==='select'&&node.props['aria-label']==='Banner status');
  assert.equal(status().props.value,existing?'published':'draft');
  if(existing){status().props.onChange({target:{value:'draft'}});tree=render();}
  else {find(tree,node=>node.type==='input'&&node.props['aria-label']==='Banner title').props.onChange({target:{value:'New draft'}});tree=render();}
  assert.ok(find(tree,node=>node.type==='image-picker'));
  await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=render();
  const saved=db.rows.get(existing?'stored':'new-banner');assert.equal(saved.enabled,false);
  if(existing)assert.equal(saved.legacy_locale,'builtin:en:main');else assert.equal(navigations[0].params.id,'new-banner');
  assert.equal(slideshow.publishedHomepageSlides([...db.rows.values()],'en').length,0);assert.equal(errors.length,0);
  find(tree,node=>node.type==='image-picker').props.onUploaded({secure_url:'https://res.cloudinary.com/demo/image/upload/new-campaign.webp',alt_text:'Campaign',width:2172,height:724});tree=render();
  status().props.onChange({target:{value:'published'}});tree=render();
  await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=render();
  assert.equal(db.rows.size,1,'Republishing must update the same banner');assert.equal(db.rows.get(existing?'stored':'new-banner').enabled,true);
  assert.equal(slideshow.publishedHomepageSlides([...db.rows.values()],'en').length,1);assert.equal(errors.length,0);h.dispose();
 }
});

test('only published slides for the selected locale are returned in stable order',()=>{
 const rows=[slide('b',{position:2}),slide('draft',{enabled:false}),slide('removed',{archived:true}),slide('fr',{locale:'fr'}),slide('a',{position:2}),slide('unsafe',{destination_url:'javascript:alert(1)'})];
 assert.deepEqual(Array.from(slideshow.publishedHomepageSlides(rows,'en'),row=>row.id),['a','b']);
 assert.equal(slideshow.HOMEPAGE_SLIDE_INTERVAL_MS,3000);
 assert.match(slideshow.homepageSlidesError({code:'PGRST205'}),/not been installed/);
 assert.match(slideshow.homepageSlidesError({code:'42501'}),/staff/);
});

test('public banner reads use the published reader and never restore defaults for empty lists or network errors',async()=>{
 let result={data:[],error:null},legacyReads=0;
 const client={rpc(name,args){assert.equal(name,'homepage_published_slides');assert.equal(args.requested_locale,'en');return {abortSignal:async()=>result}},from(){legacyReads++;const q={select(){return q},eq(){return q},order(){return q},abortSignal:async()=>({data:[slide('legacy')],error:null})};return q}};
 const api=await read('src/lib/homepage-slides-query.ts',{'./supabase':{publicSupabase:client},'./homepage-slides':slideshow},{AbortSignal});
 assert.equal((await api.getHomepageSlides('en')).length,0);assert.equal(legacyReads,0);
 result={data:[slide('active'),slide('draft',{enabled:false}),slide('deleted',{archived:true})],error:null};
 assert.deepEqual(Array.from(await api.getHomepageSlides('en'),row=>row.id),['active']);
 result={data:null,error:{code:'network'}};await assert.rejects(api.getHomepageSlides('en'),/could not be loaded/);assert.equal(legacyReads,0);
 result={data:null,error:{code:'PGRST202'}};assert.equal((await api.getHomepageSlides('en'))[0].id,'legacy');assert.equal(legacyReads,1);
});

test('the carousel rotates published database banners and never restores deleted defaults',async()=>{
 const h=hooks(),timers=new Map();let timerId=0;
 const api=compile((await fs.readFile('src/components/site/HeroSlider.tsx','utf8'))+'\nexports.Carousel=StandardHeroSlider;',{
  react:h.react,'react/jsx-runtime':jsx,'@/i18n/i18n':{t:key=>key},'@/lib/hero-image':{heroImageSources:()=>undefined},'@/lib/homepage-campaign':campaign,'@/lib/cloudinary':cloudinary,'@/lib/homepage-slides':slideshow,
 },{window:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setInterval(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),setTimeout:()=>1,clearTimeout(){},innerWidth:1280}});
 let added=[slide('first'),slide('second',{destination_url:'/en/sales'})];const render=()=>h.render(()=>api.Carousel({locale:'en',addedSlides:added}));
 let tree=render();h.flush();find(tree,node=>node.type==='img').props.onLoad();tree=render();h.flush();
 assert.equal([...timers.values()][0].ms,3000);[...timers.values()][0].fn();tree=render();h.flush();
 assert.equal(find(tree,node=>node.type==='a'&&!node.props['aria-hidden']).props.href,'/en/sales');
 find(tree,node=>node.type==='img').props.onError();tree=render();h.flush();assert.ok(find(tree,node=>node.type==='img'));assert.equal(timers.size,0);
 added=[];tree=render();h.flush();assert.equal(tree,null,'An empty published list must not resurrect hardcoded banners');h.dispose();
});

test('uploaded banner artwork keeps its full aspect ratio in responsive sources, preloading and display',async()=>{
 const source=await fs.readFile('src/components/site/HeroSlider.tsx','utf8');
 for(const viewport of [375,1440]) {
  const h=hooks(),preloads=[],callbacks=[];
  const api=compile(source+'\nexports.Carousel=StandardHeroSlider;',{
   react:h.react,'react/jsx-runtime':jsx,'@/assets':{getProductAsset:()=> 'https://res.cloudinary.com/demo/image/upload/builtin.webp'},
   '@/i18n/i18n':{t:key=>key,getLocalizedSlug:value=>value},'@/lib/hero-image':{heroImageSources:()=> 'built-in responsive sources'},
   '@/lib/homepage-campaign':campaign,'@/lib/cloudinary':cloudinary,'@/lib/homepage-slides':slideshow,
  },{window:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setInterval:()=>1,clearInterval(){},setTimeout(fn){callbacks.push(fn);return callbacks.length;},clearTimeout(){},innerWidth:viewport},Image:class{constructor(){preloads.push(this)}}});
  const added=[slide('original',{legacy_locale:'builtin:en:main',image_url:'https://res.cloudinary.com/demo/image/upload/tuxar/website/banner/photo.webp',show_text:true,image_width:1672,image_height:941}),slide('artwork',{image_width:2172,image_height:724})];
  const render=()=>h.render(()=>api.Carousel({locale:'en',addedSlides:added}));
  let tree=render();h.flush();const original=find(tree,node=>node.type==='img');
  assert.match(original.props.className,/object-cover/);assert.match(original.props.src,/h_900/);
  original.props.onLoad();tree=render();h.flush();
  callbacks.at(-1)();const preload=preloads.at(-1);
  assert.match(preload.src,/c_fit/);assert.ok(!preload.src.includes('h_'));assert.ok(!preload.srcset.includes('c_fill'));assert.ok(!preload.srcset.includes('h_'));
  find(tree,node=>node.type==='button'&&node.props['aria-label'].includes('Slide artwork')).props.onClick();tree=render();h.flush();
  const image=find(tree,node=>node.type==='img');
  assert.match(image.props.className,/object-contain/);assert.ok(!image.props.className.includes('object-cover'));
  assert.equal(image.props.width,2172);assert.equal(image.props.height,724);
  assert.match(image.props.src,/c_fit/);assert.ok(!image.props.src.includes('h_'));
  assert.ok(!image.props.srcSet.includes('c_fill'));assert.ok(!image.props.srcSet.includes('h_'));
  assert.equal(image.props.srcSet,preload.srcset);h.dispose();
 }
});

test('missing slideshow storage gives a specific setup error and Retry loads the editor after installation',async()=>{
 const h=hooks();let failure={code:'PGRST205'},ids=0;
 const q={select(){return q},eq(){return q},order(key){return key==='id'?Promise.resolve({data:[],error:failure}):q}};
 const {AdminHomepageBanner}=await read('src/components/admin/AdminBanners.tsx',{
  react:h.react,'react/jsx-runtime':jsx,'@tanstack/react-router':{Link:'route-link'},'@/i18n/i18n':{SUPPORTED_LOCALES:['en','fr']},'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/homepage-campaign':campaign,'@/lib/homepage-slides':slideshow,
  '@/lib/banner-destinations':{bannerDestinations:()=>[]},'@/lib/storefront-products':{getStorefrontProducts:async()=>[]},'@/components/admin/AdminMediaManager':{AdminMediaManager:'image-picker'},
 },{crypto:{randomUUID:()=>`test-${++ids}`}});
 const render=()=>h.render(()=>AdminHomepageBanner());render();h.flush();await settle();let tree=render();
 assert.match(text(find(tree,node=>node.props.role==='alert')),/not been installed/);assert.equal(find(tree,node=>node.type==='form'),null);
 failure=null;find(tree,node=>node.type==='button'&&text(node)==='Retry').props.onClick();render();h.flush();await settle();tree=render();assert.equal(find(tree,node=>node.type==='form'),null);assert.ok(find(tree,node=>node.type==='route-link'&&node.props.params.id==='new'));
});

test('the database update works without the old banner table, preserves multiple rows and prevents public writes',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec("create role anon;create role authenticated;create function public.is_admin(text[]) returns boolean language sql stable as $$select current_setting('test.staff',true)='yes'$$;");
 const sql=await fs.readFile('supabase/migrations/202611160002_homepage_slides.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec("insert into public.homepage_slides(locale,enabled,image_url,destination_url,title,alt_text) values('en',true,'https://example.com/a.webp','/en/shop','A','A'),('en',true,'https://example.com/b.webp','/en/sales','B','B'),('en',false,'https://example.com/draft.webp','/en/shop','Draft','Draft');");
 await db.exec('set role anon;');assert.equal((await db.query('select count(*)::int as n from public.homepage_slides')).rows[0].n,2);
 await assert.rejects(db.exec("insert into public.homepage_slides(locale) values('en')"),/permission denied/);await db.exec('reset role;');
 await db.exec("set role authenticated;set test.staff='no';");await assert.rejects(db.exec("insert into public.homepage_slides(locale) values('en')"),/row-level security/);
 await db.exec("set test.staff='yes';insert into public.homepage_slides(locale) values('fr');");assert.equal((await db.query('select count(*)::int as n from public.homepage_slides')).rows[0].n,4);
 await db.exec("update public.homepage_slides set archived=true,enabled=false where title='A';reset role;set role anon;");assert.equal((await db.query('select count(*)::int as n from public.homepage_slides')).rows[0].n,1);
});

test('upgrading an existing single banner preserves it once and never resurrects a removed slide',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec("create role anon;create role authenticated;create function public.is_admin(text[]) returns boolean language sql stable as $$select true$$;");
 await db.exec(await fs.readFile('supabase/migrations/202611050001_homepage_banners.sql','utf8'));
 await db.exec("insert into public.homepage_banners(locale,enabled,image_url,title,alt_text) values('en',true,'https://example.com/old.webp','Old campaign','Old image');");
 const sql=await fs.readFile('supabase/migrations/202611160002_homepage_slides.sql','utf8');await db.exec(sql);
 let rows=(await db.query('select * from public.homepage_slides')).rows;assert.equal(rows.length,1);assert.equal(rows[0].title,'Old campaign');assert.equal(rows[0].enabled,true);
 await db.exec("update public.homepage_slides set archived=true,enabled=false;");await db.exec(sql);
 rows=(await db.query('select * from public.homepage_slides')).rows;assert.equal(rows.length,1);assert.equal(rows[0].archived,true);assert.equal(rows[0].enabled,false);
 assert.equal((await db.query('select enabled from public.homepage_banners')).rows[0].enabled,true,'Upgrade does not change the old frontend settings');
});

test('registering the original banners preserves later drafts, deletions, uploads and product prices on reruns',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec("create role anon;create role authenticated;create function public.is_admin(text[]) returns boolean language sql stable as $$select true$$;create table public.products(slug text,price_pence int);insert into public.products values('unchanged-jacket',12700);");
 await db.exec(await fs.readFile('supabase/migrations/202611160002_homepage_slides.sql','utf8'));
 await db.exec("insert into public.homepage_slides(locale,position,enabled,image_url,destination_url,title,alt_text) values('en',1,true,'https://example.com/black-friday.webp','/en/sales','Black Friday','Campaign');");
 const sql=await fs.readFile('supabase/migrations/202611180001_manage_homepage_banners.sql','utf8');await db.exec(sql);
 assert.equal((await db.query("select count(*)::int as n from public.homepage_slides where legacy_locale like 'builtin:%'")).rows[0].n,25);
 assert.equal((await db.query("select position from public.homepage_slides where title='Black Friday'")).rows[0].position,6);
 await db.exec("update public.homepage_slides set title='Edited title',enabled=false where legacy_locale='builtin:en:main';update public.homepage_slides set archived=true,enabled=false where legacy_locale='builtin:en:bags';");
 await db.exec(sql);
 assert.deepEqual((await db.query("select title,enabled from public.homepage_slides where legacy_locale='builtin:en:main'")).rows,[{title:'Edited title',enabled:false}]);
 assert.equal((await db.query("select archived from public.homepage_slides where legacy_locale='builtin:en:bags'")).rows[0].archived,true);
 assert.equal((await db.query("select count(*)::int as n from public.homepage_slides")).rows[0].n,26);
 assert.equal((await db.query("select position from public.homepage_slides where title='Black Friday'")).rows[0].position,6);
 assert.equal((await db.query('select price_pence from public.products')).rows[0].price_pence,12700);
 await db.exec('set role anon;');
 assert.equal((await db.query("select count(*)::int as n from public.homepage_published_slides('en')")).rows[0].n,4);
 assert.equal((await db.query("select count(*)::int as n from public.homepage_slides where locale='en'")).rows[0].n,1,'Older public table readers must not duplicate their built-in originals');
 assert.equal((await db.query("select count(*)::int as n from public.homepage_published_slides('en') where not enabled or archived")).rows[0].n,0);
});
