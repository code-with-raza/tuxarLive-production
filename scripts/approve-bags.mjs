import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Approval recorded from the user's explicit instruction on 2026-11-01.
// Generates local source and SQL only; never connects to the live database.
const catalogue = JSON.parse(await fs.readFile('src/data/products/local-bags.json', 'utf8'));
const images = JSON.parse(await fs.readFile('src/data/cloudinary-assets.json', 'utf8'));
const products = catalogue.products.map(p => {
  const { cataloguePreview, previewStockPerSize, pricingStatus, ...product } = p;
  return { ...product, tagline: `${p.colors[0].name} · Bag collection`, inStock: true,
    image: images[p.image].url, gallery: p.gallery.map(source => images[source].url) };
});
if (products.length !== 11) throw Error('Expected exactly 11 approved bags');
await fs.writeFile('src/data/products/approved-bags-catalogue.json', JSON.stringify({ approvedOn: '2026-11-01', products }, null, 2) + '\n');
catalogue.pricesApproved = true;
catalogue.publishReady = true;
await fs.writeFile('src/data/products/local-bags.json', JSON.stringify(catalogue, null, 2) + '\n');
const release = products.map(p => ({ ...p, sku: 'TX-B-' + createHash('sha256').update(p.slug).digest('hex').slice(0, 12).toUpperCase() }));
const payload = JSON.stringify(release);
if (payload.includes('$bags$') || payload.includes('$activate$')) throw Error('SQL delimiter collision');
const slugs = products.map(p => `'${p.slug}'`).join(',\n  ');
await fs.writeFile('output/supabase-bags-release/04-ACTIVATE-11-APPROVED-BAGS.sql', `-- Activate the 11 EXISTING, approved bags. Do not rerun the import.
-- Changes status only; never overwrites prices, stock, photos or existing products.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $activate$
declare data jsonb := $bags$${payload}$bags$::jsonb;
p jsonb; actual record;
begin
perform e.id from public.products e join jsonb_array_elements(data) n on e.slug=n->>'slug' order by e.id for update of e;
perform v.id from public.product_variants v join public.products e on e.id=v.product_id join jsonb_array_elements(data) n on e.slug=n->>'slug' order by v.id for update of v;
if (select count(*) from public.products e join jsonb_array_elements(data) n on e.slug=n->>'slug')<>11 then
 raise exception 'Expected all 11 existing bags. No products activated.';
end if;
for p in select * from jsonb_array_elements(data) loop
 select * into actual from public.products where slug=p->>'slug';
 if actual.status not in ('draft','active') or actual.category<>'leather-bags' then
  raise exception 'Unexpected bag status/category. No products activated.';
 end if;
 if actual.status='draft' and actual.price_pence<>round((p->>'priceGBP')::numeric*100)::integer then
  raise exception 'A staged bag price differs from approval. No prices overwritten.';
 end if;
 if (select count(*) from public.product_variants where product_id=actual.id)<>1 or not exists(
  select 1 from public.product_variants where product_id=actual.id and sku=p->>'sku' and size='One Size' and color=p->'colors'->0->>'name' and active
 ) then raise exception 'Missing or mismatched bag variant. No products activated.'; end if;
 if actual.status='draft' and not exists(
  select 1 from public.product_variants where product_id=actual.id and stock=11 and (price_pence is null or price_pence=actual.price_pence)
 ) then raise exception 'Staged bag stock or variant price differs from approval. No stock overwritten.'; end if;
 if (select count(*) from public.product_images where product_id=actual.id)<>jsonb_array_length(p->'gallery') or exists(
  select 1 from jsonb_array_elements_text(p->'gallery') with ordinality expected(url,position)
  where not exists(select 1 from public.product_images where product_id=actual.id and url=expected.url and position=expected.position-1)
 ) then raise exception 'Bag gallery differs from the verified release. No products activated.'; end if;
 if exists(select 1 from jsonb_array_elements_text(p->'collections') c where not exists(
  select 1 from public.product_collections where product_id=actual.id and collection_slug=c
 )) then raise exception 'Missing bag collection membership. No products activated.'; end if;
end loop;
update public.products set status='active' where status='draft' and slug in (select value->>'slug' from jsonb_array_elements(data));
end $activate$;
commit;
select count(*) as active_bags from public.products where status='active' and slug in (
  ${slugs}
);
`);
console.log('Prepared 11 approved production bags and status-only activation SQL. No remote writes.');
