import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Offline release preparation. Never connects to or writes to Supabase.
const catalogue = JSON.parse(await fs.readFile('src/data/products/local-womens-jackets.json', 'utf8'));
const images = JSON.parse(await fs.readFile('src/data/cloudinary-assets.json', 'utf8'));
const inventory = JSON.parse(await fs.readFile('src/data/womens-inventory.json', 'utf8'));
const sizes = inventory.sizes;
if (inventory.stockPerSizePerColour !== 15 || sizes.join(',') !== 'S,M,L,XL,2XL,3XL,4XL,5XL') throw Error('Inventory approval changed; review this release before generating SQL');
const products = catalogue.products.map(original => {
  const resolve = source => {
    const entry = images[source];
    if (!entry?.verifiedSha256) throw Error(`Unverified image: ${source}`);
    return entry.url;
  };
  const { batchId, cataloguePreview, ...product } = original;
  return { ...product, audience: 'women', sizes, image: resolve(product.image), gallery: product.gallery.map(resolve), specs: product.specs.map(spec => spec.label === 'Sizing' ? { ...spec, value: 'S–5XL. Refer to the supplied size chart.' } : spec) };
});
if (products.length !== 94 || products.some(product => product.colors.length !== 1)) throw Error('Review catalogue/colour count before preparing a different release');
const variants = products.flatMap(product => sizes.map(size => ({
  productSlug: product.slug,
  sku: `TX-W-${createHash('sha256').update(product.slug).digest('hex').slice(0, 12).toUpperCase()}-${size}`,
  size, color: product.colors[0].name, colorHex: product.colors[0].hex, stock: 15,
})));
if (new Set(variants.map(variant => variant.sku)).size !== variants.length) throw Error('Duplicate SKU');
const payload = JSON.stringify({ products, variants });
if (payload.includes('$catalogue$') || payload.includes('$import$')) throw Error('SQL delimiter collision');
const output = 'output/supabase-womens-release';
await fs.mkdir(output, { recursive: true });
const slugs = products.map(product => `'${product.slug.replaceAll("'", "''")}'`).join(',\n    ');
await fs.writeFile(`${output}/01-READ-ONLY-CHECK.sql`, `-- Run in the existing Tuxar project before staging the release. No writes.
begin read only;
set local statement_timeout='30s';
select current_database() as database_name, current_setting('server_version') as postgres_version;
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and table_name in ('products','product_variants','product_images','product_collections','product_categories') order by table_name, ordinal_position;
select slug, name, status, audience from public.product_categories order by position, slug;
select slug, name, status, price_pence from public.products where slug in (
    ${slugs},
    'classic-zip-quilted'
) order by slug;
select p.slug, i.id, i.url, i.position from public.products p join public.product_images i on i.product_id=p.id where p.slug='classic-zip-quilted' order by i.position;
select p.slug, v.sku, v.size, v.color, v.stock, v.price_pence, v.active from public.products p join public.product_variants v on v.product_id=p.id where p.slug='classic-zip-quilted' order by v.size, v.color;
commit;
`);
await fs.writeFile(`${output}/02-STAGE-94-WOMENS-PRODUCTS.sql`, `-- Existing Tuxar project. Inserts new products as DRAFTS for review.
-- 94 colourways, 752 size variants, 15 per size/colour; existing prices are proposals.
-- Any product or SKU collision rolls back the entire import. Never resets existing stock.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $import$
declare data jsonb := $catalogue$${payload}$catalogue$::jsonb;
p jsonb; v jsonb; image_url text; new_id uuid; image_position integer;
begin
if exists(select 1 from public.products e join jsonb_array_elements(data->'products') n on e.slug=n->>'slug') then
raise exception 'A women product slug already exists. Stop and reconcile; no records changed.'; end if;
if exists(select 1 from public.product_variants e join jsonb_array_elements(data->'variants') n on e.sku=n->>'sku') then
raise exception 'A SKU already exists. Stop and reconcile; no records changed.'; end if;
if not exists(select 1 from public.product_categories where slug='leather-jackets' and status='active') then
raise exception 'Active leather-jackets category is required.'; end if;
for p in select * from jsonb_array_elements(data->'products') loop
insert into public.products(slug,name,tagline,description,category,price_pence,material,weight,seo_title,seo_description,status)
values(p->>'slug',p->>'name',p->>'tagline',p->>'description',p->>'category',round((p->>'priceGBP')::numeric*100)::integer,p->>'material',p->>'weight',p->>'seoTitle',p->>'seoDescription','draft') returning id into new_id;
for v in select * from jsonb_array_elements(data->'variants') where value->>'productSlug'=p->>'slug' loop
insert into public.product_variants(product_id,sku,size,color,color_hex,stock,price_pence,active)
values(new_id,v->>'sku',v->>'size',v->>'color',v->>'colorHex',(v->>'stock')::integer,round((p->>'priceGBP')::numeric*100)::integer,true);
end loop;
image_position:=0;
for image_url in select jsonb_array_elements_text(p->'gallery') loop
insert into public.product_images(product_id,url,alt_text,position) values(new_id,image_url,p->>'name',image_position);
image_position:=image_position+1;
end loop;
insert into public.product_collections(product_id,collection_slug) select new_id,jsonb_array_elements_text(p->'collections');
end loop;
end $import$;
commit;
select count(*) as staged_women_products from public.products where slug in (${slugs}) and status='draft';
`);
await fs.writeFile(`${output}/03-REPAIR-MENS-FRONT-PHOTO.sql`, `-- Repair only the existing classic-zip-quilted product. No price/stock/status edits.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $repair$
declare target_id uuid; image_ids uuid[];
begin
select id into target_id from public.products where slug='classic-zip-quilted';
if target_id is null then raise exception 'Existing men jacket not found. Stop; do not create a duplicate product.'; end if;
select array_agg(id) into image_ids from public.product_images where product_id=target_id and
(url like 'https://res.cloudinary.com/rllwk4bi/image/upload/%/classic-zip-new.webp' or url='https://res.cloudinary.com/rllwk4bi/image/upload/classic-zip-new.webp' or url='/src/assets/products/classic/zip_new.webp');
if coalesce(cardinality(image_ids),0)<>1 then raise exception 'Expected exactly one known front photo. Review the read-only check; no photos changed.'; end if;
update public.product_images set url='https://res.cloudinary.com/rllwk4bi/image/upload/v1793051072/classic-zip-new.webp' where id=image_ids[1];
end $repair$;
commit;
select p.slug,i.url,i.position from public.products p join public.product_images i on i.product_id=p.id where p.slug='classic-zip-quilted' order by i.position;
`);
await fs.writeFile(`${output}/review-plan.json`, JSON.stringify({ status: 'OFFLINE PREPARATION; NO SUPABASE WRITES', stageStatus: 'draft', prices: 'Existing proposed prices; review before activation', sizes, stockPerSizePerColour: 15, productCount: products.length, variantCount: variants.length, totalUnits: variants.reduce((sum, variant) => sum + variant.stock, 0), products, variants }, null, 2) + '\n');
await fs.writeFile(`${output}/PRICE-REVIEW.md`, '# Women’s product prices for review\n\nExisting proposed prices are retained. Products are staged as drafts until the frontend release and price review are ready.\n\n| Product | GBP |\n| --- | ---: |\n' + products.map(product => `| ${product.name.replaceAll('|', '/')} | £${product.priceGBP} |`).join('\n') + '\n');
await fs.writeFile(`${output}/START-HERE.md`, `# Supabase preparation

Use the existing project; a new Supabase project is not needed. Production reference: ncgxljatjajgcvnlrncm. The isolated restore-test project can be used for a rehearsal first.

1. Run 01-READ-ONLY-CHECK.sql in the SQL Editor and inspect the result. If any of the 94 women product slugs already exist, stop and reconcile instead of importing duplicates.
2. Review PRICE-REVIEW.md. Current proposed prices are retained; no price approval is inferred from the inventory instruction.
3. Run 02-STAGE-94-WOMENS-PRODUCTS.sql to insert drafts: 94 colourways, 752 variants, 15 units per size/colour (11,280 units). Sizes: S, M, L, XL, 2XL, 3XL, 4XL, 5XL. It does not overwrite existing products or reset stock. Running it twice aborts safely.
4. Run 03-REPAIR-MENS-FRONT-PHOTO.sql for the existing men’s quilted jacket. It changes only the known front-photo URL. Its existing price, sizes, stock, status and remaining gallery photos are preserved.
5. Share the results before activating products and building the production catalogue. The women’s frontend records are still local drafts; SQL staging alone does not complete the frontend publication step. No activation SQL is supplied in this preparation stage.

Both verified size charts are appended by the updated frontend; they do not require separate database rows per product. Deploy the rebuilt frontend to show them on the live website. Keep this preparation folder off cPanel.
`);
console.log(JSON.stringify({ products: products.length, variants: variants.length, stockPerSizePerColour: 15, totalUnits: variants.length * 15, menRepair: 'classic-zip-quilted front photo only', remoteWrites: 0, folder: output }));
