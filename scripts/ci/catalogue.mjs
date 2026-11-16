import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const categories = ['leather-jackets','motorcycle-suits','leather-bags','accessories','varsity','bomber','racing','classic','flight_jacket'];
const editable = {
  name:'name', tagline:'tagline', description:'description', category:'category',
  material:'material', weight:'weight', origin:'origin', badge:'badge',
  seoTitle:'seo_title', seoDescription:'seo_description',
  pricePence:'price_pence', comparePricePence:'compare_price_pence', status:'status',
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const own = (value,key) => Object.hasOwn(value,key);
const hash = value => createHash('sha256').update(value).digest('hex');
const q = value => value == null ? 'null' : `'${String(value).replaceAll("'","''")}'`;
const json = value => `${q(JSON.stringify(value))}::jsonb`;
function assert(condition, message) { if (!condition) throw new Error(message); }
function keys(value,allowed,label) {
  assert(value && typeof value==='object' && !Array.isArray(value),`${label}: expected an object`);
  for(const key of Object.keys(value)) assert(allowed.includes(key),`${label}: unsupported field ${key}`);
}
function text(value,label) { assert(typeof value==='string' && !value.includes('\0'),`${label}: expected text without NUL characters`); }
function money(value,label,nullable=false) { assert((nullable && value===null) || (Number.isSafeInteger(value) && value>=0 && value<=2147483647),`${label}: use nonnegative integer pence`); }

export function validateRelease(release, filename) {
  keys(release,['id','products'],'Release');
  assert(typeof release.id==='string' && /^[0-9]{8}-[a-z0-9-]+$/.test(release.id),'Release ID must start YYYYMMDD-');
  if(filename) assert(filename===`${release.id}.json`,'Release ID must match its filename');
  assert(Array.isArray(release.products) && release.products.length>0,'Release needs products');
  const seen=new Set();
  for(const item of release.products) {
    keys(item,['slug','create','fields','images','variants','collections'],'Product change');
    assert(slugPattern.test(item.slug??''),'Invalid product slug');
    assert(!seen.has(item.slug),'Duplicate product in release'); seen.add(item.slug);
    assert(item.create || Object.keys(item.fields??{}).length || item.images || item.collections,'Product change is empty');
    if(item.fields) {
      keys(item.fields,Object.keys(editable),'Product fields');
      for(const [key,value] of Object.entries(item.fields)) {
        if(key==='pricePence') money(value,key);
        else if(key==='comparePricePence') money(value,key,true);
        else if(key==='status') assert(['active','draft','archived'].includes(value),'Invalid product status');
        else if(key==='category') assert(categories.includes(value),'Invalid product category');
        else if(value!==null || !['origin','badge'].includes(key)) text(value,key);
      }
    }
    if(item.create) {
      const p=item.create;
      keys(p,['slug','name','tagline','category','priceGBP','comparePriceGBP','currency','colors','sizes','material','weight','origin','badge','rating','reviewCount','description','specs','inStock','collections','audience','seoTitle','seoDescription'],'New storefront product');
      assert(p.slug===item.slug,'New product slug mismatch');
      assert(categories.includes(p.category),'Invalid new product category');
      for(const key of ['name','tagline','material','weight','description']) text(p[key],key);
      assert(p.name.trim() && p.description.trim(),'New products need a name and description');
      for(const key of ['origin','badge','seoTitle','seoDescription']) if(own(p,key)) text(p[key],key);
      assert(p.currency==='GBP' && Number.isFinite(p.priceGBP),'New product price must be GBP');
      money(Math.round(p.priceGBP*100),'priceGBP');
      if(own(p,'comparePriceGBP')) { money(Math.round(p.comparePriceGBP*100),'comparePriceGBP'); assert(p.comparePriceGBP>=p.priceGBP,'Previous price must be at least the current price'); }
      assert(['men','women','both'].includes(p.audience),'New product needs an audience');
      assert(Array.isArray(p.sizes) && p.sizes.length && new Set(p.sizes).size===p.sizes.length,'New product needs unique sizes');
      p.sizes.forEach(size=>{text(size,'Size');assert(size.trim(),'Empty size');});
      assert(Array.isArray(p.colors) && p.colors.length,'New product needs colours');
      for(const color of p.colors) { keys(color,['name','hex'],'Colour');text(color.name,'Colour');assert(color.name.trim() && /^#[0-9a-f]{6}$/i.test(color.hex),'Invalid colour'); }
      assert(new Set(p.colors.map(c=>c.name)).size===p.colors.length,'Duplicate colour');
      assert(Array.isArray(p.specs),'New product needs specifications');
      for(const spec of p.specs) { keys(spec,['label','value'],'Specification');text(spec.label,'Specification label');text(spec.value,'Specification value'); }
      assert(typeof p.inStock==='boolean' && Number.isFinite(p.rating) && p.rating>=0 && p.rating<=5 && Number.isSafeInteger(p.reviewCount) && p.reviewCount>=0,'Invalid availability or review data');
      assert(Array.isArray(item.images) && item.images.length,'New products need images');
      assert(Array.isArray(item.variants) && item.variants.length,'New products need initial variants and stock');
    } else assert(!item.variants,'Existing stock is managed by orders/admin; use a separate reviewed migration for inventory changes');
    if(item.images) {
      assert(Array.isArray(item.images) && item.images.length,'Images must be a nonempty full gallery');
      for(const image of item.images) {
        keys(image,['source','alt'],'Image'); text(image.source,'Image source');text(image.alt,'Image alt text');
        assert(image.alt.trim(),'Image alt text is required');
        assert(/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(image.source) || /^(deployment\/media|src\/assets)\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g|avif)$/i.test(image.source),'Use a committed image path or a Cloudinary HTTPS URL');
        assert(!image.source.split('/').includes('..'),'Image traversal is forbidden');
      }
      assert(new Set(item.images.map(i=>i.source)).size===item.images.length,'Duplicate image source');
    }
    if(item.variants) {
      const combinations=new Set(),skus=new Set();
      for(const v of item.variants) {
        keys(v,['sku','size','color','colorHex','stock'],'Variant');
        assert(typeof v.sku==='string' && /^[A-Z0-9-]{1,80}$/.test(v.sku) && !skus.has(v.sku),'Invalid or duplicate SKU'); skus.add(v.sku);
        assert(item.create.sizes.includes(v.size) && item.create.colors.some(c=>c.name===v.color && c.hex.toLowerCase()===v.colorHex?.toLowerCase()),'Variant must match storefront size and colour');
        money(v.stock,'Initial stock'); const pair=JSON.stringify([v.size,v.color]);assert(!combinations.has(pair),'Duplicate size/colour variant');combinations.add(pair);
      }
      assert(combinations.size===item.create.sizes.length*item.create.colors.length,'Supply every storefront size/colour variant');
    }
    for(const list of [item.collections,item.create?.collections].filter(value=>value!==undefined)) {
      assert(Array.isArray(list) && list.every(value=>typeof value==='string' && slugPattern.test(value)) && new Set(list).size===list.length,'Invalid or duplicate collection slug');
    }
    if(item.collections && item.create?.collections) assert(JSON.stringify(item.collections)===JSON.stringify(item.create.collections),'New product collection lists must agree');
  }
  return release;
}

export async function imageBytes(root,source) {
  const target=path.resolve(root,source), real=await fs.realpath(target), parent=await fs.realpath(root);
  assert(real.startsWith(parent+path.sep) && real===target,'Image must be a regular file inside the repository, without symlinks');
  const bytes=await fs.readFile(real);
  assert(bytes.length>0 && bytes.length<=10*1024*1024,'Image must be at most 10 MB');
  const format=path.extname(source).slice(1).toLowerCase();
  assert((format==='webp' && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') || (format==='png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (['jpg','jpeg'].includes(format) && bytes[0]===255 && bytes[1]===216) || (format==='avif' && bytes.toString('ascii',4,8)==='ftyp' && /avif|avis/.test(bytes.toString('ascii',8,32))),'Image signature does not match its filename');
  return bytes;
}

export async function uploadImage(bytes,credentials,fetcher=fetch) {
  const {cloudName,apiKey,apiSecret}=credentials;
  assert(/^[a-z0-9_-]+$/i.test(cloudName??'') && apiKey && apiSecret,'Cloudinary credentials are missing');
  const publicId=`tuxar/ci/${hash(bytes)}`;
  const parameters={overwrite:'false',public_id:publicId,timestamp:String(Math.floor(Date.now()/1000))};
  const signature=createHash('sha1').update(Object.entries(parameters).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+apiSecret).digest('hex');
  const body=new FormData(); for(const [k,v] of Object.entries(parameters)) body.append(k,v);
  body.append('api_key',apiKey);body.append('signature',signature);body.append('file',new Blob([bytes]));
  const response=await fetcher(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{method:'POST',body,signal:AbortSignal.timeout(120000)});
  assert(response.ok,'Cloudinary upload failed; no product links have been changed');
  const asset=await response.json();
  assert(asset.public_id===publicId && asset.secure_url?.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`),'Unexpected Cloudinary upload response');
  return asset.secure_url;
}

export async function verifyImageUrl(url,fetcher=fetch) {
  const response=await fetcher(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(30000)});
  assert(response.ok && /^image\/(jpeg|png|webp|avif)(?:;|$)/i.test(response.headers.get('content-type')??''),'A referenced Cloudinary URL is missing or is not a supported public image');
}

function frontendFields(fields={}) {
  return Object.fromEntries(Object.entries(fields).filter(([key])=>!['status','pricePence','comparePricePence'].includes(key)));
}

export function releaseSql(releases) {
  const blocks=["begin;", "set local lock_timeout='10s';", "set local statement_timeout='120s';", "select pg_advisory_xact_lock(hashtext('tuxar-catalogue-release'));", "do $release$ declare previous record; target_id uuid; image_record record; begin"];
  // Removing or editing an applied manifest would make fresh builds disagree with
  // the database. Refuse it rather than treating it as a rollback.
  blocks.push(`if exists(select 1 from deployment.catalogue_releases where id not in (select value->>'id' from jsonb_array_elements(${json(releases.map(r=>({id:r.id})))}))) then raise exception 'An applied catalogue release was removed from Git. Restore it and add a new corrective release.'; end if;`);
  for(const release of releases) {
    blocks.push(`select * into previous from deployment.catalogue_releases where id=${q(release.id)}; if found then if previous.digest<>${q(release.digest)} then raise exception 'An applied catalogue release was edited. Restore it and add a new release.'; end if; else
if exists(select 1 from deployment.catalogue_releases where id>${q(release.id)}) then raise exception 'New catalogue release IDs must sort after applied releases. Use a later date/counter.'; end if;`);
    for(const item of release.products) {
      const p=item.create;
      if(p) {
        const values={slug:item.slug,name:p.name,tagline:p.tagline,description:p.description,category:p.category,price_pence:Math.round(p.priceGBP*100),compare_price_pence:p.comparePriceGBP===undefined?null:Math.round(p.comparePriceGBP*100),material:p.material,weight:p.weight,origin:p.origin??null,badge:p.badge??null,seo_title:p.seoTitle??'',seo_description:p.seoDescription??'',status:'draft'};
        blocks.push(`if exists(select 1 from public.products where slug=${q(item.slug)}) then raise exception 'New product slug already exists; reconcile before deployment'; end if;`);
        blocks.push(`insert into public.products(${Object.keys(values).join(',')}) values(${Object.values(values).map(q).join(',')}) returning id into target_id;`);
        for(const v of item.variants) blocks.push(`insert into public.product_variants(product_id,sku,size,color,color_hex,stock,price_pence,active) values(target_id,${q(v.sku)},${q(v.size)},${q(v.color)},${q(v.colorHex)},${v.stock},null,true);`);
      } else blocks.push(`select id into target_id from public.products where slug=${q(item.slug)} for update; if not found then raise exception 'Target product is missing; no changes applied'; end if;`);
      if(own(item.fields??{},'pricePence')) blocks.push(`update public.product_variants set price_pence=${item.fields.pricePence},updated_at=now() where product_id=target_id and price_pence=(select price_pence from public.products where id=target_id);`);
      if(Object.keys(item.fields??{}).length) blocks.push(`update public.products set ${Object.entries(item.fields).map(([key,value])=>`${editable[key]}=${q(value)}`).join(',')},updated_at=now() where id=target_id;`);
      if(item.images) {
        blocks.push(`delete from public.product_images where product_id=target_id;`);
        for(const [position,image] of item.images.entries()) blocks.push(`insert into public.product_images(product_id,url,alt_text,position) values(target_id,${q(image.url)},${q(image.alt)},${position});
insert into public.media_assets(provider,secure_url,alt_text,title,entity_type,entity_id,media_role,position) values('cloudinary',${q(image.url)},${q(image.alt)},${q(image.alt)},'product',target_id,'gallery',${position});`);
      }
      const collections=item.collections??p?.collections;
      if(collections) {
        blocks.push('delete from public.product_collections where product_id=target_id;');
        for(const slug of collections) blocks.push(`insert into public.product_collections(product_id,collection_slug) values(target_id,${q(slug)});`);
      }
    }
    blocks.push(`insert into deployment.catalogue_releases(id,digest) values(${q(release.id)},${q(release.digest)}); end if;`);
  }
  blocks.push('end $release$;','commit;');
  return blocks.join('\n')+'\n';
}

export async function prepareCatalogue({root=process.cwd(),upload=false,credentials={},uploader=uploadImage,verifier=verifyImageUrl}={}) {
  const directory=path.join(root,'deployment/catalogue'), releases=[], output={products:[],overrides:{}};
  const uploaded=new Map(), created=new Set();
  for(const filename of (await fs.readdir(directory)).filter(name=>name.endsWith('.json')).sort()) {
    const raw=await fs.readFile(path.join(directory,filename),'utf8');
    const release=validateRelease(JSON.parse(raw),filename);
    const resolved={...release,digest:hash(raw),products:[]};
    for(const original of release.products) {
      const item=structuredClone(original), contentHashes=[];
      if(item.create) { assert(!created.has(item.slug),'A product can only be created once');created.add(item.slug); }
      for(const image of item.images??[]) {
        if(image.source.startsWith('https://')) {
          const url=new URL(image.source); assert(!url.username && !url.password && !url.hash && !url.search && url.hostname==='res.cloudinary.com','Invalid Cloudinary URL');
          if(credentials.cloudName) assert(url.pathname.startsWith(`/${credentials.cloudName}/image/upload/`),'Image belongs to another Cloudinary account');
          image.url=image.source; contentHashes.push(hash(image.source));
        } else {
          const bytes=await imageBytes(root,image.source), digest=hash(bytes); contentHashes.push(digest);
          if(!uploaded.has(digest)) uploaded.set(digest,upload ? await uploader(bytes,credentials) : `https://res.cloudinary.com/ci-validation/image/upload/tuxar/ci/${digest}.webp`);
          image.url=uploaded.get(digest);
        }
      }
      // Images are part of immutable history too; replacing bytes at an old path
      // without adding a release must not silently change its meaning.
      resolved.digest=hash(resolved.digest+JSON.stringify(contentHashes));
      resolved.products.push(item);
      if(item.create) output.products.push({...item.create,image:item.images[0].url,gallery:item.images.map(i=>i.url)});
      const fields={...frontendFields(item.fields),...(item.collections?{collections:item.collections}:{})};
      if(item.images) Object.assign(fields,{image:item.images[0].url,gallery:item.images.map(i=>i.url)});
      output.overrides[item.slug]={...output.overrides[item.slug],...fields};
    }
    releases.push(resolved);
  }
  if(upload) {
    const urls=[...new Set(releases.flatMap(release=>release.products.flatMap(product=>(product.images??[]).map(image=>image.url))))];
    for(let offset=0;offset<urls.length;offset+=8) await Promise.all(urls.slice(offset,offset+8).map(url=>verifier(url)));
  }
  return {releases,frontend:output,sql:releaseSql(releases)};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const upload=process.argv.includes('--upload');
    const result=await prepareCatalogue({upload,credentials:{cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,apiSecret:process.env.CLOUDINARY_API_SECRET}});
    await fs.mkdir('output/ci',{recursive:true});
    await fs.writeFile('output/ci/catalogue-plan.json',JSON.stringify(result.releases,null,2)+'\n');
    await fs.writeFile('output/ci/catalogue.sql',result.sql);
    if(process.argv.includes('--write-frontend')) await fs.writeFile('src/data/products/deployment-catalogue.json',JSON.stringify(result.frontend,null,2)+'\n');
    console.log(`Validated ${result.releases.length} catalogue releases; ${upload?'Cloudinary uploads resolved':'no remote writes'}.`);
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
