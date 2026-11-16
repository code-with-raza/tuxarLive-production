create table if not exists public.media_assets (
 id uuid primary key default gen_random_uuid(),
 provider text not null default 'cloudinary' check(provider in ('cloudinary','external','local')),
 public_id text,
 secure_url text not null,
 original_url text,
 original_filename text not null default '',
 seo_filename text not null default '',
 alt_text text not null default '',
 title text not null default '',
 caption text not null default '',
 width integer check(width is null or width>0),
 height integer check(height is null or height>0),
 format text,
 bytes integer check(bytes is null or bytes>=0),
 media_scope text not null default 'website' check(media_scope in ('website','email')),
 entity_type text not null,
 entity_id uuid,
 entity_key text,
 media_role text not null default 'gallery',
 position integer not null default 0,
 focal_x numeric(5,2) not null default 50 check(focal_x between 0 and 100),
 focal_y numeric(5,2) not null default 50 check(focal_y between 0 and 100),
 status text not null default 'active' check(status in ('active','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists media_assets_entity_idx on public.media_assets(entity_type,entity_id,entity_key,status,position);
create unique index if not exists media_assets_public_id_idx on public.media_assets(public_id) where public_id is not null;
alter table public.media_assets enable row level security;
create policy "public reads active media" on public.media_assets for select using(status='active');
create policy "editors insert media" on public.media_assets for insert to authenticated with check(public.is_admin(array['owner','admin','editor']));
create policy "editors update media" on public.media_assets for update to authenticated using(public.is_admin(array['owner','admin','editor'])) with check(public.is_admin(array['owner','admin','editor']));

alter table public.product_images add column if not exists media_asset_id uuid references public.media_assets(id) on delete set null;
alter table public.blog_posts add column if not exists cover_media_id uuid references public.media_assets(id) on delete set null;
alter table public.product_categories add column if not exists hero_media_id uuid references public.media_assets(id) on delete set null;
alter table public.product_categories add column if not exists mobile_hero_media_id uuid references public.media_assets(id) on delete set null;
alter table public.marketing_templates add column if not exists banner_media_id uuid references public.media_assets(id) on delete set null;
