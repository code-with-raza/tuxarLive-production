create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description text not null default '',
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value integer not null check (discount_value > 0),
  minimum_order_pence integer not null default 0 check (minimum_order_pence >= 0),
  maximum_discount_pence integer check (maximum_discount_pence is null or maximum_discount_pence > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

alter table public.coupons enable row level security;

create policy "catalog staff can read coupons" on public.coupons
for select to authenticated using (public.is_admin(array['owner','admin','editor']));

create policy "catalog staff can create coupons" on public.coupons
for insert to authenticated with check (public.is_admin(array['owner','admin','editor']));

create policy "catalog staff can update coupons" on public.coupons
for update to authenticated using (public.is_admin(array['owner','admin','editor']))
with check (public.is_admin(array['owner','admin','editor']));

create index if not exists coupons_status_dates_idx on public.coupons(status, starts_at, expires_at);
