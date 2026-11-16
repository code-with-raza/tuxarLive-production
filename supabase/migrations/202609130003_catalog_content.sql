create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  tagline text not null default '',
  description text not null default '',
  category text not null,
  price_pence integer not null check (price_pence >= 0),
  compare_price_pence integer check (compare_price_pence is null or compare_price_pence >= price_pence),
  material text not null default '',
  weight text not null default '',
  origin text,
  badge text,
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  color text not null,
  color_hex text not null default '#111111',
  stock integer not null default 0 check (stock >= 0),
  price_pence integer check (price_pence is null or price_pence >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_slug text not null,
  primary key (product_id, collection_slug)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en' check (locale in ('en','de','fr','it','es')),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  excerpt text not null default '',
  content_markdown text not null default '',
  category text not null default 'Journal',
  author text not null default 'Tuxar Atelier',
  cover_image_url text,
  cover_image_alt text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(locale, slug)
);

create index if not exists products_status_category_idx on public.products(status, category);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_images_product_position_idx on public.product_images(product_id, position);
create index if not exists blog_posts_status_locale_published_idx on public.blog_posts(status, locale, published_at desc);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_collections enable row level security;
alter table public.blog_posts enable row level security;

create policy "public reads active products" on public.products for select using (status = 'active');
create policy "catalog staff reads all products" on public.products for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "catalog staff manages products" on public.products for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
create policy "public reads active variants" on public.product_variants for select using (exists(select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "catalog staff reads all variants" on public.product_variants for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "catalog staff manages variants" on public.product_variants for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
create policy "public reads active product images" on public.product_images for select using (exists(select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "catalog staff reads all images" on public.product_images for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "catalog staff manages images" on public.product_images for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
create policy "public reads active product collections" on public.product_collections for select using (exists(select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "catalog staff reads all collections" on public.product_collections for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "catalog staff manages collections" on public.product_collections for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
create policy "public reads published blogs" on public.blog_posts for select using (status = 'published');
create policy "editors read all blogs" on public.blog_posts for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "editors manage blogs" on public.blog_posts for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media','product-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
       ('blog-media','blog-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy "public reads commerce media" on storage.objects for select using (bucket_id in ('product-media','blog-media'));
create policy "editors upload commerce media" on storage.objects for insert to authenticated with check (bucket_id in ('product-media','blog-media') and public.is_admin(array['owner','admin','editor']));
create policy "editors update commerce media" on storage.objects for update to authenticated using (bucket_id in ('product-media','blog-media') and public.is_admin(array['owner','admin','editor']));
create policy "editors delete commerce media" on storage.objects for delete to authenticated using (bucket_id in ('product-media','blog-media') and public.is_admin(array['owner','admin','editor']));
