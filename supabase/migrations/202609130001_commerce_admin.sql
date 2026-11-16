create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'fulfilment', 'editor')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(required_roles text[] default array['owner','admin'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = any(required_roles)
  );
$$;

create or replace function public.is_admin_aal2(required_roles text[] default array['owner','admin'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and public.is_admin(required_roles);
$$;

revoke all on function public.is_admin(text[]) from public;
revoke all on function public.is_admin_aal2(text[]) from public;
grant execute on function public.is_admin(text[]) to authenticated;
grant execute on function public.is_admin_aal2(text[]) to authenticated;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address_line1 text not null,
  shipping_address_line2 text,
  shipping_city text not null,
  shipping_postal_code text not null,
  shipping_country text not null,
  shipping_method text not null check (shipping_method in ('STANDARD', 'EXPRESS')),
  currency text not null default 'GBP' check (currency = 'GBP'),
  subtotal_pence integer not null check (subtotal_pence >= 0),
  shipping_pence integer not null default 0 check (shipping_pence >= 0),
  total_pence integer not null check (total_pence >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  fulfilment_status text not null default 'unfulfilled' check (fulfilment_status in ('unfulfilled','processing','fulfilled','cancelled')),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_slug text not null,
  product_name text not null,
  sku text,
  size text,
  color text,
  quantity integer not null check (quantity between 1 and 100),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_payment_fulfilment_idx on public.orders(payment_status, fulfilment_status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "users read own orders" on public.orders
  for select to authenticated using (user_id = auth.uid());
create policy "admins read orders with mfa" on public.orders
  for select to authenticated using (public.is_admin_aal2(array['owner','admin','fulfilment']));
create policy "admins update orders with mfa" on public.orders
  for update to authenticated using (public.is_admin_aal2(array['owner','admin','fulfilment']))
  with check (public.is_admin_aal2(array['owner','admin','fulfilment']));

create policy "users read own order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );
create policy "admins read order items with mfa" on public.order_items
  for select to authenticated using (public.is_admin_aal2(array['owner','admin','fulfilment']));

create policy "staff read own admin membership" on public.admin_users
  for select to authenticated using (user_id = auth.uid());
create policy "owners manage staff with mfa" on public.admin_users
  for all to authenticated using (public.is_admin_aal2(array['owner']))
  with check (public.is_admin_aal2(array['owner']));

create policy "admins read audit log with mfa" on public.admin_audit_log
  for select to authenticated using (public.is_admin_aal2(array['owner','admin']));
create policy "admins create audit entries with mfa" on public.admin_audit_log
  for insert to authenticated with check (
    admin_user_id = auth.uid() and public.is_admin_aal2(array['owner','admin','fulfilment'])
  );

-- Bootstrap the first owner only after that person has registered and verified their email:
-- insert into public.admin_users (user_id, role)
-- select id, 'owner' from auth.users where lower(email) = lower('OWNER_EMAIL_HERE');
