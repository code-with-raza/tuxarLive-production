-- Tuxar catalogue publication. Target: ncgxljatjajgcvnlrncm.
-- Insert-only: any existing product slug or SKU aborts the entire transaction.
-- Does not reset stock, change schema/security, or touch orders/users/payments.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $import$
declare data jsonb := $payload$__CATALOGUE_PAYLOAD__$payload$::jsonb;
p jsonb; v jsonb; image_url text; product_id uuid; image_position integer;
begin
if exists(select 1 from public.products existing join jsonb_array_elements(data->'products') incoming on existing.slug=incoming->>'slug') then
raise exception 'Product slug already exists. No records changed; reconcile before retrying.'; end if;
if exists(select 1 from public.product_variants existing join jsonb_array_elements(data->'variants') incoming on existing.sku=incoming->>'sku') then
raise exception 'SKU already exists. No records changed; reconcile before retrying.'; end if;
if exists(select 1 from jsonb_array_elements(data->'products') incoming where not exists(select 1 from public.product_categories c where c.slug=incoming->>'category' and c.status='active')) then
raise exception 'Required parent category is unavailable'; end if;
for p in select * from jsonb_array_elements(data->'products') loop
insert into public.products(slug,name,tagline,description,category,price_pence,material,weight,seo_title,seo_description,status)
values(p->>'slug',p->>'name',p->>'tagline',p->>'description',p->>'category',round((p->>'priceGBP')::numeric*100)::integer,p->>'material',p->>'weight',p->>'seoTitle',p->>'seoDescription','active') returning id into product_id;
for v in select * from jsonb_array_elements(data->'variants') where value->>'productSlug'=p->>'slug' loop
insert into public.product_variants(product_id,sku,size,color,color_hex,stock,price_pence,active)
values(product_id,v->>'sku',v->>'size',v->>'colour',p->'colors'->0->>'hex',10,round((p->>'priceGBP')::numeric*100)::integer,true);
end loop;
image_position:=0;
for image_url in select jsonb_array_elements_text(p->'gallery') loop
insert into public.product_images(product_id,url,alt_text,position) values(product_id,image_url,p->>'name',image_position);
image_position:=image_position+1;
end loop;
insert into public.product_collections(product_id,collection_slug) select product_id,jsonb_array_elements_text(p->'collections');
end loop;
end $import$;
commit;
select count(*) as imported_products from public.products where slug in (select value->>'slug' from jsonb_array_elements(($payload$__CATALOGUE_SLUGS__$payload$)::jsonb));
