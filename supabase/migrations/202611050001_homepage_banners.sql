begin;
create table if not exists public.homepage_banners (
  locale text primary key check (locale in ('en','de','es','fr','it')),
  enabled boolean not null default false,
  image_url text not null default '' check (length(image_url) <= 4096 and (image_url = '' or image_url ~ '^https://[^[:space:]]+$')),
  destination_url text not null default '/en/sales' check (length(destination_url) <= 4096 and destination_url !~ '[[:space:]\\]' and (destination_url ~ '^https://[^/]' or destination_url ~ '^/[^/]')),
  title text not null default '' check (length(title) <= 180),
  alt_text text not null default '' check (length(alt_text) <= 500),
  button_label text not null default '' check (length(button_label) <= 80),
  image_width integer not null default 1920 check (image_width between 1 and 50000),
  image_height integer not null default 640 check (image_height between 1 and 50000),
  check (not enabled or (image_url <> '' and title <> '' and alt_text <> ''))
);
alter table public.homepage_banners enable row level security;
revoke all on public.homepage_banners from anon, authenticated;
grant select on public.homepage_banners to anon, authenticated;
grant insert, update on public.homepage_banners to authenticated;
create policy "public reads enabled homepage banners" on public.homepage_banners for select to anon, authenticated using (enabled);
create policy "staff reads homepage banners" on public.homepage_banners for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "staff creates homepage banners" on public.homepage_banners for insert to authenticated with check (public.is_admin(array['owner','admin','editor']));
create policy "staff updates homepage banners" on public.homepage_banners for update to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
commit;
