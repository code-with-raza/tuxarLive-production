-- Add the two storefront jackets absent from the commerce catalog. Existing products
-- and inventory are never updated by this migration. Stock of 10 per size was
-- explicitly confirmed by the store owner on 2026-09-23.
insert into public.products
  (slug, name, tagline, description, category, price_pence, material, weight, origin, badge, seo_title, seo_description, status)
values
  ('monaco-leather-racer', 'Monaco Black Leather Cafe Racer Jacket',
   'Men''s full-grain calfskin cafe racer jacket',
   'A men''s black leather cafe racer jacket cut from full-grain calfskin. The streamlined profile, low collar and clean zip front create a versatile everyday jacket with authentic racer character.',
   'leather-jackets', 39900, '1.2mm Full-Grain Italian Calfskin', '1.6 kg', 'Made in Italy', 'Best Seller',
   'Monaco Black Leather Cafe Racer Jacket', 'Full-grain black calfskin cafe racer jacket with a clean zip front and low collar.', 'active'),
  ('aviator-g1-shearling', 'G-1 Brown Leather Shearling Flight Jacket',
   'Men''s brown leather aviator jacket with detachable shearling collar',
   'A men''s G-1 brown leather flight jacket with a detachable genuine shearling collar. Hand-burnished calfskin, ribbed trims and a substantial aviator silhouette provide warmth and heritage style.',
   'leather-jackets', 49900, '1.3mm Hand-Burnished Italian Calfskin', '1.9 kg', 'Made in Italy', 'Limited',
   'G-1 Brown Leather Shearling Flight Jacket', 'Brown calfskin G-1 flight jacket with a detachable genuine shearling collar.', 'active')
on conflict (slug) do nothing;

insert into public.product_variants(product_id, sku, size, color, color_hex, stock)
select p.id, upper(p.slug || '-' || v.color_slug || '-' || v.size), v.size, v.color, v.color_hex, 10
from public.products p
join (values
  ('monaco-leather-racer', 'Black', 'black', '#1a1a1a', 'S'),
  ('monaco-leather-racer', 'Black', 'black', '#1a1a1a', 'M'),
  ('monaco-leather-racer', 'Black', 'black', '#1a1a1a', 'L'),
  ('monaco-leather-racer', 'Black', 'black', '#1a1a1a', 'XL'),
  ('aviator-g1-shearling', 'Distressed Brown', 'distressed-brown', '#3d2b1f', 'S'),
  ('aviator-g1-shearling', 'Distressed Brown', 'distressed-brown', '#3d2b1f', 'M'),
  ('aviator-g1-shearling', 'Distressed Brown', 'distressed-brown', '#3d2b1f', 'L'),
  ('aviator-g1-shearling', 'Distressed Brown', 'distressed-brown', '#3d2b1f', 'XL'),
  ('aviator-g1-shearling', 'Distressed Brown', 'distressed-brown', '#3d2b1f', 'XXL')
) as v(slug, color, color_slug, color_hex, size) on p.slug = v.slug
where not exists (
  select 1 from public.product_variants existing
  where existing.product_id = p.id and existing.color = v.color and existing.size = v.size
)
on conflict (sku) do nothing;

insert into public.product_images(product_id, url, alt_text, position)
select p.id, i.url, i.alt_text, i.position
from public.products p
join (values
  ('monaco-leather-racer', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994627/tuxar/website/product/calfskin-calf-skin.webp', 'Monaco black leather cafe racer jacket, front view', 0),
  ('aviator-g1-shearling', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994611/tuxar/website/product/bomber-01-shearling-main.webp', 'G-1 brown leather shearling flight jacket, front view', 0),
  ('aviator-g1-shearling', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994613/tuxar/website/product/bomber-02-shearling-side.webp', 'G-1 brown leather shearling flight jacket, side view', 1),
  ('aviator-g1-shearling', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994616/tuxar/website/product/bomber-03-shearling-collar.webp', 'Close-up of G-1 jacket detachable shearling collar', 2)
) as i(slug, url, alt_text, position) on p.slug = i.slug
where not exists (select 1 from public.product_images existing where existing.product_id = p.id and existing.url = i.url);

insert into public.product_collections(product_id, collection_slug)
select p.id, c.collection_slug
from public.products p
join (values
  ('monaco-leather-racer', 'cafe-racer-jackets'),
  ('monaco-leather-racer', 'motorcycle-jackets'),
  ('aviator-g1-shearling', 'bomber-jackets')
) as c(slug, collection_slug) on p.slug = c.slug
on conflict do nothing;
