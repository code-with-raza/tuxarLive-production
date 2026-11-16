import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
function compile(source,modules={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]??{},URL,...globals});return exports;}
const read=(file,modules={},globals={})=>fs.readFile(file,'utf8').then(source=>compile(source,modules,globals));
const campaign=await read('src/lib/homepage-campaign.ts');
const slideshow=await read('src/lib/homepage-slides.ts',{'./homepage-campaign':campaign});
const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null;};
const text=node=>typeof node==='string'?node:node&&typeof node==='object'?[node.props?.children].flat(Infinity).map(text).join(' '):'';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function hooks(){let cursor=0;const states=[],refs=[],deps=[],pending=[],cleanups=[];return {react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}];},useRef(initial){const i=cursor++;return refs[i]??(refs[i]={current:initial});},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(fn,next){const i=cursor++;if(!deps[i]||next.some((value,k)=>value!==deps[i][k])){deps[i]=next;pending.push(()=>{cleanups[i]?.();cleanups[i]=fn()});}}},render(fn){cursor=0;return fn();},flush(){while(pending.length)pending.shift()();},dispose(){cleanups.forEach(fn=>fn?.());}};}
const slide=(id,overrides={})=>({id,locale:'en',position:1,enabled:true,archived:false,image_url:`https://res.cloudinary.com/demo/image/upload/${id}.webp`,destination_url:'/en/shop',title:`Slide ${id}`,alt_text:`Image ${id}`,button_label:'Shop',eyebrow:'',subtitle:'',show_text:false,tone:'light',image_width:1920,image_height:1080,...overrides});

test('only published slides for the selected locale are returned in stable order',()=>{
 const rows=[slide('b',{position:2}),slide('draft',{enabled:false}),slide('removed',{archived:true}),slide('fr',{locale:'fr'}),slide('a',{position:2}),slide('unsafe',{destination_url:'javascript:alert(1)'})];
 assert.deepEqual(Array.from(slideshow.publishedHomepageSlides(rows,'en'),row=>row.id),['a','b']);
 assert.equal(slideshow.HOMEPAGE_SLIDE_INTERVAL_MS,3000);
 assert.match(slideshow.homepageSlidesError({code:'PGRST205'}),/not been installed/);
 assert.match(slideshow.homepageSlidesError({code:'42501'}),/staff/);
});

test('the admin can add multiple independent slides, keep drafts hidden and remove only the selected slide',async()=>{
 const h=hooks(),rows=new Map(),writes=[],errors=[];let uuid=0;
 const supabase={from(table){assert.equal(table,'homepage_slides');let saved,patch,id;const q={select(){return q},eq(key,value){if(key==='id')id=value;return q},order(key){return key==='id'?Promise.resolve({data:[...rows.values()].filter(row=>!row.archived),error:null}):q},upsert(row){saved=row;return q},update(value){patch=value;return q},async single(){if(saved){rows.set(saved.id,{...saved});writes.push({action:'save',row:{...saved}});return {data:saved,error:null};}const old=rows.get(id);if(!old)return {error:{message:'Missing slide'}};rows.set(id,{...old,...patch});writes.push({action:'remove',id});return {data:{id},error:null};}};return q;}};
 class Image{naturalWidth=2400;naturalHeight=800;set src(value){queueMicrotask(()=>this.onload?.());}}
 const {AdminHomepageBanner}=await read('src/components/admin/AdminHomepageBanner.tsx',{
  react:h.react,'react/jsx-runtime':jsx,'@/lib/supabase':{supabase},'@/lib/homepage-campaign':campaign,'@/lib/homepage-slides':slideshow,
  '@/lib/banner-destinations':{bannerDestinations:()=>[{href:'/en/shop',label:'Shop',group:'Pages'},{href:'/en/sales',label:'Sale',group:'Pages'}]},
  '@/lib/storefront-products':{getStorefrontProducts:async()=>[]},'@/components/admin/AdminMediaManager':{AdminMediaManager:'image-picker'},sonner:{toast:{success(){},error:message=>errors.push(message)}},
 },{crypto:{randomUUID:()=>`slide-${++uuid}`},Image,window:{setTimeout,clearTimeout}});
 const render=()=>h.render(()=>AdminHomepageBanner());render();h.flush();await settle();let tree=render();
 const input=(label)=>find(tree,node=>node.type==='input'&&node.props['aria-label']===label);
 const button=(label)=>find(tree,node=>node.type==='button'&&text(node)===label);
 find(tree,node=>node.type==='image-picker').props.onUploaded({secure_url:slide('first').image_url,alt_text:'First image',width:1920,height:1080});tree=render();input('Slide title').props.onChange({target:{value:'First campaign'}});tree=render();assert.equal(writes.length,0);
 await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(rows.size,1);const first=[...rows.values()][0];assert.equal(first.image_width,2400);
 tree=render();button('Add slide').props.onClick();tree=render();const staleUpload=find(tree,node=>node.type==='image-picker').props.onUploaded;
 find(tree,node=>node.type==='image-picker').props.onSelect({secure_url:slide('second').image_url,alt_text:'Second image',width:1920,height:1080});tree=render();input('Slide title').props.onChange({target:{value:'Second campaign'}});tree=render();
 find(tree,node=>node.type==='select'&&node.props['aria-label']==='Click destination').props.onChange({target:{value:'/en/shop'}});tree=render();
 await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(rows.size,2);assert.equal(rows.get(first.id).image_url,slide('first').image_url);
 const second=[...rows.values()].find(row=>row.id!==first.id);assert.equal(second.destination_url,'/en/shop');assert.ok(second.position>first.position);
 tree=render();button('Add slide').props.onClick();tree=render();staleUpload({secure_url:slide('late').image_url,alt_text:'Late',width:1,height:1});tree=render();assert.equal(input('Image URL').props.value,'','Old upload must not overwrite another new slide');
 const firstList=find(tree,node=>node.type==='li'&&text(node).includes('First campaign'));find(firstList,node=>node.type==='button'&&text(node)==='Edit slide').props.onClick();tree=render();
 find(tree,node=>node.type==='input'&&node.props.type==='checkbox'&&!node.props['aria-label']).props.onChange({target:{checked:false}});tree=render();await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(rows.get(first.id).enabled,false);assert.deepEqual(Array.from(slideshow.publishedHomepageSlides([...rows.values()],'en'),row=>row.id),[second.id]);
 tree=render();const firstItem=find(tree,node=>node.type==='li'&&text(node).includes('First campaign'));find(firstItem,node=>node.type==='button'&&text(node)==='Remove slide').props.onClick();await settle();tree=render();
 assert.equal(rows.get(first.id).archived,true);assert.equal(rows.get(second.id).enabled,true);assert.ok(text(tree).includes('Second campaign'));assert.equal(errors.length,0);
});

test('the actual carousel appends slides, uses their individual links and rotates after three seconds',async()=>{
 const h=hooks();const source=await fs.readFile('src/components/site/HeroSlider.tsx','utf8');const timers=new Map();let timerId=0;
 const {HeroSlider}=compile(source+'\nexports.StandardHeroSlider=StandardHeroSlider;',{
  react:h.react,'react/jsx-runtime':jsx,'@/assets':{getProductAsset:path=>`https://example.com${path}`},
  '@/i18n/i18n':{t:key=>key,getLocalizedSlug:value=>value},'@/lib/hero-image':{heroImageSources:()=>undefined},'@/lib/cloudinary':{cloudinaryUrl:url=>url},'@/lib/homepage-slides':slideshow,
 },{window:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setInterval(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),setTimeout:()=>1,clearTimeout(){},innerWidth:1280}});
 // Obtain the real child component without starting its network-only parent effect.
 const parent=h.render(()=>HeroSlider({locale:'en'}));const Component=parent.type;const childHooks=hooks();
 // Recompile with independent hook storage for the child, then drive image load/timer events.
 const api=compile(source+'\nexports.Carousel=StandardHeroSlider;',{
  react:childHooks.react,'react/jsx-runtime':jsx,'@/assets':{getProductAsset:path=>`https://example.com${path}`},
  '@/i18n/i18n':{t:key=>key,getLocalizedSlug:value=>value},'@/lib/hero-image':{heroImageSources:()=>undefined},'@/lib/cloudinary':{cloudinaryUrl:url=>url},'@/lib/homepage-slides':slideshow,
 },{window:{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setInterval(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),setTimeout:()=>1,clearTimeout(){},innerWidth:1280}});
 assert.equal(typeof Component,'function');let added=[slide('first'),slide('second',{destination_url:'/en/sales'})];
 const render=()=>childHooks.render(()=>api.Carousel({locale:'en',addedSlides:added}));let tree=render();childHooks.flush();
 const collect=(node,predicate,result=[])=>{if(node&&typeof node==='object'){if(predicate(node))result.push(node);for(const child of [node.props?.children].flat(Infinity))collect(child,predicate,result);}return result;};
 assert.equal(collect(tree,n=>n.type==='button').length,7);assert.equal(collect(tree,n=>n.type==='img').length,1);
 find(tree,n=>n.type==='img').props.onLoad();tree=render();childHooks.flush();assert.equal([...timers.values()][0].ms,3000);
 for(let i=0;i<5;i++){[...timers.values()][0].fn();tree=render();childHooks.flush();}
 assert.equal(find(tree,n=>n.type==='a'&&n.props['aria-hidden']===false).props.href,'/en/shop');
 [...timers.values()][0].fn();tree=render();childHooks.flush();assert.equal(find(tree,n=>n.type==='a'&&n.props['aria-hidden']===false).props.href,'/en/sales');
 // A broken added image is skipped while the five original slides remain.
 find(tree,n=>n.type==='img').props.onError();tree=render();childHooks.flush();assert.equal(collect(tree,n=>n.type==='button').length,6);assert.ok(find(tree,n=>n.type==='img'));
 added=[];tree=render();childHooks.flush();assert.equal(collect(tree,n=>n.type==='button').length,5);assert.ok(find(tree,n=>n.type==='a'&&n.props['aria-hidden']===false));
 childHooks.dispose();
});

test('missing slideshow storage gives a specific setup error and Retry loads the editor after installation',async()=>{
 const h=hooks();let failure={code:'PGRST205'},ids=0;
 const q={select(){return q},eq(){return q},order(key){return key==='id'?Promise.resolve({data:[],error:failure}):q}};
 const {AdminHomepageBanner}=await read('src/components/admin/AdminHomepageBanner.tsx',{
  react:h.react,'react/jsx-runtime':jsx,'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/homepage-campaign':campaign,'@/lib/homepage-slides':slideshow,
  '@/lib/banner-destinations':{bannerDestinations:()=>[]},'@/lib/storefront-products':{getStorefrontProducts:async()=>[]},'@/components/admin/AdminMediaManager':{AdminMediaManager:'image-picker'},
 },{crypto:{randomUUID:()=>`test-${++ids}`}});
 const render=()=>h.render(()=>AdminHomepageBanner());render();h.flush();await settle();let tree=render();
 assert.match(text(find(tree,node=>node.props.role==='alert')),/not been installed/);assert.equal(find(tree,node=>node.type==='form'),null);
 failure=null;find(tree,node=>node.type==='button'&&text(node)==='Retry').props.onClick();render();h.flush();await settle();tree=render();assert.ok(find(tree,node=>node.type==='form'));assert.ok(find(tree,node=>node.type==='image-picker'));
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
