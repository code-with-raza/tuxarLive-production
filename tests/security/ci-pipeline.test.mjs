import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {prepareCatalogue,validateRelease,releaseSql,uploadImage,verifyImageUrl} from '../../scripts/ci/catalogue.mjs';
import {migrationPreflightSql,validateBackendEnvironment,functionSecretsFile,postgresEnvironment} from '../../scripts/ci/backend.mjs';
import {releaseManifest} from '../../scripts/ci/release.mjs';
const require=createRequire(import.meta.url);

test('psql gets the remote connection fields and decodes special characters without a local socket fallback',()=>{
  const ref='a'.repeat(20),password='sample!@#$%';
  const database=new URL(`postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`);
  const env=postgresEnvironment(database,{PGHOST:'localhost',PGHOSTADDR:'127.0.0.1',PGDATABASE:'old',PGSERVICE:'local',PGOPTIONS:'-c default_transaction_read_only=on'});
  assert.equal(env.PGHOST,'aws-1-eu-west-1.pooler.supabase.com');
  assert.equal(env.PGPORT,'5432');assert.equal(env.PGDATABASE,'postgres');
  assert.equal(env.PGUSER,`postgres.${ref}`);assert.equal(env.PGPASSWORD,password);
  assert.equal(env.PGSSLMODE,'require');assert.equal(env.PGCONNECT_TIMEOUT,'15');
  assert.equal(env.PGOPTIONS,'-c default_transaction_read_only=on');
  assert.equal(env.PGHOSTADDR,undefined);assert.equal(env.PGSERVICE,undefined);
});

test('Cloudinary upload diagnostics identify the failure without exposing provider responses or secrets',async()=>{
  const credentials={cloudName:'test-cloud',apiKey:'test-key',apiSecret:'test-secret'};
  for(const [status,hint] of [[401,/same active key/],[403,/Contributor access/],[400,/folder mode/]]) {
    await assert.rejects(()=>uploadImage(Buffer.from('test'),credentials,async()=>({ok:false,status,json:async()=>{throw Error('Provider details must not be logged');}})),error=>{
      assert.ok(error.message.includes(`HTTP ${status}`));assert.match(error.message,hint);
      assert.ok(!error.message.includes(credentials.apiSecret));return true;
    });
  }
});

test('manual setup stays separate from publication and isolates temporary administrator credentials',async()=>{
  const setup=require('js-yaml').load(await fs.readFile('.github/workflows/setup-check.yml','utf8'));
  const deploy=require('js-yaml').load(await fs.readFile('.github/workflows/deploy.yml','utf8'));
  assert.deepEqual(Object.keys(setup.on),['workflow_dispatch']);
  assert.equal(setup.on.workflow_dispatch.inputs.configure_cloudinary_folder.default,false);
  assert.equal(setup.permissions.contents,'read');
  for(const job of Object.values(setup.jobs)) {
    assert.equal(job.if,"github.ref == 'refs/heads/main'");
    assert.equal(job.environment,'production');
    assert.ok(!JSON.stringify(job).includes('hosting.py publish'));
    assert.ok(!JSON.stringify(job).includes('db push'));
  }
  const database=setup.jobs.database.steps.find(step=>step.run);
  assert.equal(database.run,'node scripts/ci/backend.mjs --check');
  assert.equal(database.env.PGOPTIONS,'-c default_transaction_read_only=on');
  const administrator=setup.jobs.cloudinary.steps.filter(step=>step.env?.CLOUDINARY_SETUP_API_SECRET);
  assert.equal(administrator.length,1);
  assert.equal(administrator[0].if,'inputs.configure_cloudinary_folder');
  assert.ok(!JSON.stringify(deploy).includes('CLOUDINARY_SETUP_'));
  assert.ok(deploy.jobs.production.steps.some(step=>step.run==='node scripts/ci/cloudinary-check.mjs'));
});
const url='https://res.cloudinary.com/test-cloud/image/upload/v1/jacket.webp';
const change=()=>({id:'20261116-update',products:[{slug:'existing-jacket',fields:{pricePence:13900,comparePricePence:18900,status:'draft'},images:[{source:url,alt:'Front view'}]}]});
const newProduct=()=>({slug:'new-jacket',create:{slug:'new-jacket',name:'New jacket',tagline:'Black leather',category:'leather-jackets',priceGBP:150,currency:'GBP',colors:[{name:'Black',hex:'#111111'}],sizes:['M'],material:'Leather',weight:'',audience:'men',rating:0,reviewCount:0,description:'A new jacket.',specs:[],inStock:true,collections:['biker-jackets']},images:[{source:url,alt:'New jacket front'}],variants:[{sku:'NEW-JACKET-M',size:'M',color:'Black',colorHex:'#111111',stock:5}]});
async function fixture(t,release=change()) {
  const temporary=path.resolve('output/ci-tests');await fs.mkdir(temporary,{recursive:true});
  const root=await fs.mkdtemp(path.join(temporary,'tuxar-ci-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'deployment/catalogue'),{recursive:true});
  await fs.writeFile(path.join(root,`deployment/catalogue/${release.id}.json`),JSON.stringify(release));return root;
}
async function database(t) {
  const db=new PGlite();t.after(()=>db.close());
  const schema=(await fs.readFile('supabase/migrations/202609130003_catalog_content.sql','utf8')).split('create table if not exists public.blog_posts')[0];
  await db.exec(`create role anon;create role authenticated;${schema}
create table public.media_assets(id uuid default gen_random_uuid(),provider text,secure_url text,alt_text text,title text,entity_type text,entity_id uuid,media_role text,position integer);
${await fs.readFile('supabase/migrations/202611160001_deployment_ledger.sql','utf8')}
insert into public.products(slug,name,category,price_pence,status) values('existing-jacket','Existing jacket','leather-jackets',18900,'active');
insert into public.product_variants(product_id,sku,size,color,stock,price_pence) select id,'EXISTING-M','M','Black',7,18900 from public.products;
insert into public.product_variants(product_id,sku,size,color,stock,price_pence) select id,'CUSTOM-L','L','Black',2,21000 from public.products;`);
  return db;
}

test('catalogue changes resolve both database and storefront images without remote writes in CI',async t=>{
  const root=await fixture(t);const plan=await prepareCatalogue({root});
  assert.equal(plan.frontend.overrides['existing-jacket'].image,url);assert.equal(plan.frontend.overrides['existing-jacket'].gallery[0],url);
  assert.ok(!Object.hasOwn(plan.frontend.overrides['existing-jacket'],'pricePence'));assert.ok(!Object.hasOwn(plan.frontend.overrides['existing-jacket'],'status'));
  const db=await database(t);await db.exec(plan.sql);
  assert.equal((await db.query('select price_pence,status from public.products')).rows[0].price_pence,13900);
  assert.equal((await db.query('select url from public.product_images')).rows[0].url,url);
  const variants=(await db.query('select sku,price_pence,stock from public.product_variants order by sku')).rows;
  assert.deepEqual(variants,[{sku:'CUSTOM-L',price_pence:21000,stock:2},{sku:'EXISTING-M',price_pence:13900,stock:7}]);
  await db.exec("update public.products set price_pence=14900,status='archived';update public.product_variants set stock=1;update public.product_images set url='https://example.com/admin.jpg';");
  await db.exec(plan.sql);
  assert.deepEqual((await db.query('select price_pence,status from public.products')).rows,[{price_pence:14900,status:'archived'}]);
  assert.equal((await db.query('select url from public.product_images')).rows[0].url,'https://example.com/admin.jpg');
  assert.ok((await db.query('select stock from public.product_variants')).rows.every(v=>v.stock===1));
});

test('new products are inserted once as drafts with explicitly supplied inventory',async t=>{
  const root=await fixture(t,{id:'20261116-new',products:[newProduct()]});const plan=await prepareCatalogue({root});const db=await database(t);
  await db.exec(plan.sql);assert.equal(plan.frontend.products[0].image,url);
  const row=(await db.query("select status,price_pence from public.products where slug='new-jacket'")).rows[0];assert.deepEqual(row,{status:'draft',price_pence:15000});
  await db.exec("update public.product_variants set stock=3 where sku='NEW-JACKET-M';");await db.exec(plan.sql);
  assert.equal((await db.query("select stock from public.product_variants where sku='NEW-JACKET-M'")).rows[0].stock,3);
});

test('a missing product rolls back the whole release and edited/removed applied releases are rejected',async t=>{
  const root=await fixture(t);const plan=await prepareCatalogue({root});const db=await database(t);
  const broken=structuredClone(plan.releases);broken[0].products.push({slug:'missing',fields:{status:'active'}});
  await assert.rejects(db.exec(releaseSql(broken)),/missing/);await db.exec('rollback;');
  assert.equal((await db.query('select price_pence from public.products')).rows[0].price_pence,18900);assert.equal((await db.query('select count(*)::int as n from deployment.catalogue_releases')).rows[0].n,0);
  await db.exec(plan.sql);const edited=structuredClone(plan.releases);edited[0].digest='different';await assert.rejects(db.exec(releaseSql(edited)),/edited/);await db.exec('rollback;');
  await assert.rejects(db.exec(releaseSql([])),/removed/);await db.exec('rollback;');
  const earlier={...structuredClone(plan.releases[0]),id:'20261115-older',digest:'new'};
  await assert.rejects(db.exec(releaseSql([earlier,...plan.releases])),/sort after/);await db.exec('rollback;');
});

test('Cloudinary uploads use content-addressed IDs and overwrite=false, then reuse the returned URL',async()=>{
  const bytes=Buffer.from('image-bytes');let seen;
  const credentials={cloudName:'test-cloud',apiKey:'test-key',apiSecret:'test-secret'};
  const expected='tuxar/ci/'+createHash('sha256').update(bytes).digest('hex');
  const result=await uploadImage(bytes,credentials,async(endpoint,options)=>{seen=options.body;assert.equal(endpoint,'https://api.cloudinary.com/v1_1/test-cloud/image/upload');return {ok:true,json:async()=>({public_id:expected,secure_url:`https://res.cloudinary.com/test-cloud/image/upload/v1/${expected}.webp`})};});
  assert.equal(seen.get('public_id'),expected);assert.equal(seen.get('overwrite'),'false');assert.match(seen.get('signature'),/^[0-9a-f]{40}$/);assert.ok(result.includes(expected));
  await assert.rejects(uploadImage(bytes,credentials,async()=>({ok:false})),/upload failed/);
});

test('manifest validation rejects unknown fields, traversal, duplicate variants and implicit inventory resets',()=>{
  for(const mutate of [r=>{r.products[0].fields.stock=10},r=>{r.products[0].fields.prciePence=1},r=>{r.products[0].images[0].source='deployment/media/../secret.webp'},r=>{r.products[0].variants=[]},r=>{r.products.push(r.products[0])}]) {const release=change();mutate(release);assert.throws(()=>validateRelease(release));}
  const duplicate={id:'20261116-new',products:[newProduct()]};duplicate.products[0].variants.push(duplicate.products[0].variants[0]);assert.throws(()=>validateRelease(duplicate),/duplicate/i);
});

test('image bytes are validated, reused within one build and included in immutable release history',async t=>{
  const release=change();release.products[0].images[0].source='deployment/media/front.webp';const root=await fixture(t,release);
  await fs.mkdir(path.join(root,'deployment/media'));const bytes=Buffer.from('RIFF1234WEBPdata');await fs.writeFile(path.join(root,'deployment/media/front.webp'),bytes);
  let uploads=0;const plan=await prepareCatalogue({root,upload:true,uploader:async()=>{uploads++;return url;},verifier:async()=>{}});assert.equal(uploads,1);assert.equal(plan.frontend.overrides['existing-jacket'].image,url);
  await fs.writeFile(path.join(root,'deployment/media/front.webp'),Buffer.from('RIFF1234WEBPchanged'));const changed=await prepareCatalogue({root});assert.notEqual(changed.releases[0].digest,plan.releases[0].digest);
  await fs.writeFile(path.join(root,'deployment/media/front.webp'),'not an image');await assert.rejects(prepareCatalogue({root}),/signature/);
});

test('existing image URLs must be publicly readable image responses before database updates',async()=>{
  await verifyImageUrl(url,async(_url,options)=>{assert.equal(options.method,'HEAD');assert.equal(options.redirect,'error');return {ok:true,headers:new Headers({'content-type':'image/webp'})};});
  for(const response of [{ok:false,headers:new Headers()},{ok:true,headers:new Headers({'content-type':'text/html'})}]) await assert.rejects(verifyImageUrl(url,async()=>response),/referenced Cloudinary URL/);
});

test('production configuration rejects mismatched Supabase targets and unsafe function secret input',()=>{
  const ref='a'.repeat(20),env={SUPABASE_ACCESS_TOKEN:'test',SUPABASE_DB_URL:`postgresql://postgres:password@db.${ref}.supabase.co/postgres`,SUPABASE_PROJECT_REF:ref,VITE_SUPABASE_URL:`https://${ref}.supabase.co`,VITE_SUPABASE_PUBLISHABLE_KEY:'public',VITE_STRIPE_ENABLED:'false'};
  assert.equal(validateBackendEnvironment(env).ref,ref);assert.throws(()=>validateBackendEnvironment({...env,SUPABASE_PROJECT_REF:'b'.repeat(20)}));
  assert.throws(()=>functionSecretsFile(JSON.stringify({VITE_RESEND_API_KEY:'bad'})));assert.throws(()=>functionSecretsFile(JSON.stringify({RESEND_API_KEY:'two\nlines'})));
  assert.ok(functionSecretsFile(JSON.stringify({AUTH_FROM_EMAIL:'Tuxar <accounts@example.com>'})).includes('AUTH_FROM_EMAIL='));
  assert.match(migrationPreflightSql(['202610310001','202611160001']),/Reconcile|reconcile/);assert.throws(()=>migrationPreflightSql(['unsafe\';sql']));
});

test('production deployment is branch-gated, serialized, secret-isolated and restores hosting after a failed live check',async()=>{
  const workflow=require('js-yaml').load(await fs.readFile('.github/workflows/deploy.yml','utf8'));
  assert.equal(workflow.permissions.contents,'read');assert.equal(workflow.concurrency['cancel-in-progress'],false);assert.ok(!workflow.on.pull_request_target);
  const checks=workflow.jobs.checks,production=workflow.jobs.production;
  assert.ok(production.if.includes("vars.DEPLOY_ENABLED == 'true'"));assert.ok(production.if.includes("github.event_name != 'pull_request'"));assert.ok(production.if.includes("vars.PRODUCTION_BRANCH || 'main'"));assert.equal(production.environment.name,'production');
  assert.ok(!JSON.stringify(checks).includes('secrets.'));
  for(const job of [checks,production])for(const step of job.steps)if(step.uses)assert.match(step.uses,/@[0-9a-f]{40}$/);
  const backend=production.steps.findIndex(s=>s.run==='node scripts/ci/backend.mjs');const prerender=production.steps.findIndex(s=>s.run==='node scripts/prerender-public-pages.mjs');const publish=production.steps.findIndex(s=>s.id==='publish');assert.ok(backend<prerender && prerender<publish);
  assert.ok(production.steps.at(-1).if.includes("steps.smoke.outcome == 'failure'"));
  assert.ok(!JSON.stringify(workflow).includes('generate-catalog-seed'));assert.ok(!JSON.stringify(workflow).includes('db reset'));
});

test('release validation rejects private files, incomplete prerenders and tampered deployment identities',async t=>{
  const temporary=path.resolve('output/ci-tests');await fs.mkdir(temporary,{recursive:true});
  const root=await fs.mkdtemp(path.join(temporary,'tuxar-artifact-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const revision='a'.repeat(40);
  for(const file of ['index.html','.htaccess','robots.txt','sitemap.xml','deployment.json',...['en','de','fr','it','es'].map(l=>`prerender-home/${l}.html`),'prerender-pages/en/product/example/index.html']){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),file==='deployment.json'?JSON.stringify({revision}):'public');}
  assert.equal((await releaseManifest(root,revision)).revision,revision);await fs.writeFile(path.join(root,'.env'),'private');await assert.rejects(releaseManifest(root,revision),/Unexpected public file/);
});
