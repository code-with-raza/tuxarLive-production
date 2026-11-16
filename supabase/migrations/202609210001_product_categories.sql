create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active','hidden','archived')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_categories (slug,name,position)
values
 ('leather-jackets','Leather Jackets',10),
 ('motorcycle-suits','Motorcycle Suits',20),
 ('leather-bags','Leather Bags',30),
 ('accessories','Accessories',40),
 ('varsity','Varsity',50),
 ('bomber','Bomber',60),
 ('racing','Racing',70),
 ('classic','Classic',80),
 ('flight_jacket','Flight Jackets',90)
on conflict (slug) do nothing;

alter table public.product_categories enable row level security;
create policy "public reads active product categories" on public.product_categories for select using (status='active');
create policy "catalog staff reads all product categories" on public.product_categories for select to authenticated using (public.is_admin(array['owner','admin','editor']));
create policy "catalog staff manages product categories" on public.product_categories for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
create index if not exists product_categories_status_position_idx on public.product_categories(status,position,name);
