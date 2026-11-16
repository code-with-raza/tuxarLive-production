import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Offline SQL preparation only: no remote database connection or writes.
const catalogue = JSON.parse(await fs.readFile('src/data/products/local-bags.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile('src/data/cloudinary-assets.json', 'utf8'));
const verification = JSON.parse(await fs.readFile('output/bags-prepared-20261101/cloudinary-verification.json', 'utf8'));
const products = catalogue.products.map(p => ({
  slug: p.slug, name: p.name, tagline: `${p.colors[0].name} · Bag collection`, description: p.description,
  category: 'leather-bags', pricePence: Math.round(p.priceGBP * 100), material: p.material,
  seoTitle: p.seoTitle, seoDescription: p.seoDescription, collections: p.collections,
  color: p.colors[0].name, colorHex: p.colors[0].hex, stock: p.previewStockPerSize,
  sku: 'TX-B-' + createHash('sha256').update(p.slug).digest('hex').slice(0, 12).toUpperCase(),
  gallery: p.gallery.map(source => {
    const url = manifest[source]?.url;
    if (!verification.some(v => v.source === source && v.url === url && v.pixelMatch === true && v.status === 200)) throw Error(`Unverified bag photo: ${source}`);
    return url;
  }),
}));
if (products.length !== 11 || products.some(p => p.stock !== 11) || products.reduce((n, p) => n + p.gallery.length, 0) !== 15) throw Error('Unexpected bag release counts');
const payload = JSON.stringify(products);
if (payload.includes('$bags$') || payload.includes('$import$')) throw Error('SQL delimiter collision');
const slugs = products.map(p => "'" + p.slug.replaceAll("'", "''") + "'").join(',\n  ');
const folder = 'output/supabase-bags-release';
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(`${folder}/01-CHECK-BEFORE-IMPORT.sql`, `-- Read only. Use the existing Tuxar project, not a new project.
begin read only;
select slug, name, status from public.product_categories where slug='leather-bags';
-- Expected: no rows. If there are rows, stop: these products already exist.
select slug, name, status, price_pence from public.products where slug in (
  ${slugs}
) order by slug;
commit;
`);
await fs.writeFile(`${folder}/02-IMPORT-11-BAGS-AS-DRAFTS.sql`, `-- Proposed prices: DRAFT import only. No publication or updates to existing records.
-- 11 products, 11 One Size variants, 15 Cloudinary photos, 11 units each (121 total).
-- Any product/SKU collision aborts the entire transaction. Do not remove these checks.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $import$
declare data jsonb := $bags$${payload}$bags$::jsonb;
p jsonb; target_id uuid; image_url text; image_position integer;
begin
if not exists(select 1 from public.product_categories where slug='leather-bags' and status='active') then
  raise exception 'Active leather-bags category is required. No changes made.';
end if;
if exists(select 1 from public.products e join jsonb_array_elements(data) n on e.slug=n->>'slug') then
  raise exception 'A bag slug already exists. Stop and reconcile; no existing products updated.';
end if;
if exists(select 1 from public.product_variants e join jsonb_array_elements(data) n on e.sku=n->>'sku') then
  raise exception 'A bag SKU already exists. Stop and reconcile; no stock reset.';
end if;
for p in select * from jsonb_array_elements(data) loop
  insert into public.products(slug,name,tagline,description,category,price_pence,material,weight,seo_title,seo_description,status)
  values(p->>'slug',p->>'name',p->>'tagline',p->>'description','leather-bags',(p->>'pricePence')::integer,p->>'material','',p->>'seoTitle',p->>'seoDescription','draft') returning id into target_id;
  -- NULL variant price inherits the product price; review proposed prices in the admin.
  insert into public.product_variants(product_id,sku,size,color,color_hex,stock,price_pence,active)
  values(target_id,p->>'sku','One Size',p->>'color',p->>'colorHex',(p->>'stock')::integer,null,true);
  image_position:=0;
  for image_url in select jsonb_array_elements_text(p->'gallery') loop
    insert into public.product_images(product_id,url,alt_text,position) values(target_id,image_url,p->>'name',image_position);
    image_position:=image_position+1;
  end loop;
  insert into public.product_collections(product_id,collection_slug) select target_id,jsonb_array_elements_text(p->'collections');
end loop;
end $import$;
commit;
select count(*) as imported_bag_drafts from public.products where status='draft' and slug in (
  ${slugs}
);
`);
await fs.writeFile(`${folder}/03-VERIFY-BAGS.sql`, `-- Read only. Expected: 11 bags, 11 drafts, 11 variants, 15 photos, 121 units.
with bags as (select * from public.products where slug in (
  ${slugs}
))
select count(*) as bags,
 count(*) filter(where status='draft') as draft_bags,
 (select count(*) from public.product_variants where product_id in (select id from bags)) as variants,
 (select count(*) from public.product_images where product_id in (select id from bags)) as photos,
 (select sum(stock) from public.product_variants where product_id in (select id from bags)) as total_units
from bags;
`);
console.log(JSON.stringify({ folder, products: 11, variants: 11, photos: 15, totalUnits: 121, status: 'draft', remoteWrites: 0 }));
