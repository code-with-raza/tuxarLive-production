-- Additive metadata only: do not alter memberships, products, prices or publication status.
alter table public.product_categories add column if not exists seo_title text not null default '';
alter table public.product_categories add column if not exists seo_description text not null default '';
alter table public.product_categories add column if not exists content_translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(content_translations) = 'object');

-- Explicitly requested public English metadata. Existing name/description remain untouched.
update public.product_categories
set seo_title = 'Men’s Cafe Racer Jackets | Tuxar',
    seo_description = 'Explore men’s cafe racer jackets with stand collars, striped sleeves and quilted details. Compare materials, colours and sizes, with UK delivery options.',
    updated_at = now()
where slug = 'cafe-racer-jackets';
