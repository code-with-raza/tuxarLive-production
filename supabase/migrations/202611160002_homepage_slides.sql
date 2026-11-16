-- Adds slides to the existing homepage carousel, rather than replacing it.
-- This file also works on installations where the earlier single-banner table
-- was never created. Existing products, media, orders and stock are untouched.
begin;
create table if not exists public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en','de','es','fr','it')),
  enabled boolean not null default false,
  archived boolean not null default false,
  position integer not null default 5 check (position between 0 and 100000),
  image_url text not null default '' check (length(image_url)<=4096 and (image_url='' or image_url ~ '^https://[^[:space:]]+$')),
  destination_url text not null default '/en/sales' check (length(destination_url)<=4096 and destination_url !~ '[[:space:]\\]' and (destination_url ~ '^https://[^/]' or destination_url ~ '^/[^/]')),
  title text not null default '' check (length(title)<=180),
  alt_text text not null default '' check (length(alt_text)<=500),
  button_label text not null default '' check (length(button_label)<=80),
  eyebrow text not null default '' check (length(eyebrow)<=120),
  subtitle text not null default '' check (length(subtitle)<=1000),
  show_text boolean not null default false,
  tone text not null default 'light' check (tone in ('light','dark')),
  image_width integer not null default 1920 check (image_width between 1 and 50000),
  image_height integer not null default 1080 check (image_height between 1 and 50000),
  legacy_locale text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (image_url<>'' and title<>'' and alt_text<>''))
);
create index if not exists homepage_slides_locale_position_idx on public.homepage_slides(locale,position,id) where not archived;
alter table public.homepage_slides enable row level security;
revoke all on public.homepage_slides from anon, authenticated;
grant select on public.homepage_slides to anon, authenticated;
grant insert, update on public.homepage_slides to authenticated;
drop policy if exists "public reads published homepage slides" on public.homepage_slides;
create policy "public reads published homepage slides" on public.homepage_slides for select to anon, authenticated using (enabled and not archived);
drop policy if exists "staff reads homepage slides" on public.homepage_slides;
create policy "staff reads homepage slides" on public.homepage_slides for select to authenticated using (public.is_admin(array['owner','admin','editor']));
drop policy if exists "staff creates homepage slides" on public.homepage_slides;
create policy "staff creates homepage slides" on public.homepage_slides for insert to authenticated with check (public.is_admin(array['owner','admin','editor']));
drop policy if exists "staff updates homepage slides" on public.homepage_slides;
create policy "staff updates homepage slides" on public.homepage_slides for update to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));

-- Retain a previously saved single campaign as an additional slide. A stable
-- legacy key makes reruns harmless, including after a slide has been removed.
do $upgrade$
begin
  if to_regclass('public.homepage_banners') is not null then
    insert into public.homepage_slides(locale,enabled,image_url,destination_url,title,alt_text,button_label,image_width,image_height,legacy_locale)
    select locale,enabled,image_url,destination_url,title,alt_text,button_label,image_width,image_height,locale
    from public.homepage_banners where image_url<>''
    on conflict (legacy_locale) do nothing;
  end if;
end $upgrade$;
notify pgrst, 'reload schema';
commit;
