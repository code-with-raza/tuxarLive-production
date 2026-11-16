create extension if not exists citext;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  registration_method text not null default 'email' check (registration_method in ('email','google')),
  tuxar_verified boolean not null default false,
  verified_at timestamptz,
  account_status text not null default 'pending' check (account_status in ('pending','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preserve users created before this workflow; only new registrations require the new Tuxar gate.
insert into public.customer_profiles (user_id,email,first_name,last_name,registration_method,tuxar_verified,verified_at,account_status,created_at,updated_at)
select id,email,
  coalesce(raw_user_meta_data->>'first_name',raw_user_meta_data->>'given_name',''),
  coalesce(raw_user_meta_data->>'last_name',raw_user_meta_data->>'family_name',''),
  case when coalesce(raw_app_meta_data->>'provider','email') = 'google' then 'google' else 'email' end,
  true,coalesce(email_confirmed_at,created_at),'active',created_at,now()
from auth.users where email is not null
on conflict (user_id) do nothing;

create or replace function public.create_pending_customer_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.customer_profiles (user_id,email,first_name,last_name,registration_method)
    values (
      new.id,lower(new.email),
      coalesce(new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'given_name',''),
      coalesce(new.raw_user_meta_data->>'last_name',new.raw_user_meta_data->>'family_name',''),
      case when coalesce(new.raw_app_meta_data->>'provider','email') = 'google' then 'google' else 'email' end
    ) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer_profile on auth.users;
create trigger on_auth_user_created_customer_profile after insert on auth.users
for each row execute function public.create_pending_customer_profile();

create table if not exists public.customer_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_otp_active_idx on public.customer_otp_challenges(user_id,created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.customer_otp_challenges enable row level security;
create policy "customers read own profile" on public.customer_profiles for select to authenticated using (user_id=auth.uid());
create policy "customers update own ordinary profile fields" on public.customer_profiles for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "admins read customer profiles" on public.customer_profiles for select to authenticated using (public.is_admin(array['owner','admin','fulfilment']));
revoke update on public.customer_profiles from authenticated;
grant update (first_name,last_name,phone,updated_at) on public.customer_profiles to authenticated;

create or replace function public.activate_email_customer_profile()
returns boolean language plpgsql security definer set search_path=public,auth
as $$
declare provider text; confirmed timestamptz;
begin
  select coalesce(raw_app_meta_data->>'provider','email'),email_confirmed_at into provider,confirmed from auth.users where id=auth.uid();
  if provider <> 'email' or confirmed is null then raise exception 'Email verification is incomplete'; end if;
  update public.customer_profiles set tuxar_verified=true,verified_at=now(),account_status='active',updated_at=now() where user_id=auth.uid();
  return found;
end;
$$;
revoke all on function public.activate_email_customer_profile() from public;
grant execute on function public.activate_email_customer_profile() to authenticated;

alter table public.orders add column if not exists payment_method text not null default 'stripe' check (payment_method in ('stripe','cod'));
alter table public.orders add column if not exists order_status text not null default 'pending' check (order_status in ('pending','dispatched','fulfilled','cancelled'));
alter table public.orders add column if not exists cod_status text check (cod_status is null or cod_status in ('pending','collected','cancelled'));
alter table public.orders add column if not exists dispatched_at timestamptz;
alter table public.orders add column if not exists courier text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists estimated_delivery_from date;
alter table public.orders add column if not exists estimated_delivery_to date;
alter table public.orders add column if not exists idempotency_key text unique;
alter table public.orders add column if not exists dispatch_email_sent_at timestamptz;

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id),
  order_id uuid references public.orders(id) on delete set null,
  quantity_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.inventory_movements enable row level security;
create policy "admins read inventory movements" on public.inventory_movements for select to authenticated using (public.is_admin(array['owner','admin','fulfilment']));

create index if not exists orders_method_status_idx on public.orders(payment_method,order_status,created_at desc);

create or replace function public.place_cod_order(customer jsonb, items jsonb, request_key text)
returns jsonb language plpgsql security definer set search_path=public,auth
as $$
declare
  profile public.customer_profiles%rowtype;
  order_id uuid; order_no text; subtotal integer:=0; shipping integer:=0;
  row_item jsonb; product_row record; variant_row record; quantity integer;
begin
  select * into profile from public.customer_profiles where user_id=auth.uid() for update;
  if profile.user_id is null or not profile.tuxar_verified or profile.account_status<>'active' then raise exception 'Verified customer account required'; end if;
  if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>20 then raise exception 'Invalid cart'; end if;
  if exists(select 1 from public.orders where idempotency_key=request_key) then
    return (select jsonb_build_object('id',id,'orderNumber',order_number,'totalPence',total_pence) from public.orders where idempotency_key=request_key);
  end if;
  order_no := 'TX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  shipping := case when customer->>'shippingMethod'='EXPRESS' then 1500 else 0 end;
  insert into public.orders(order_number,user_id,customer_name,customer_email,customer_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_postal_code,shipping_country,shipping_method,subtotal_pence,shipping_pence,total_pence,payment_method,payment_status,fulfilment_status,order_status,cod_status,idempotency_key,estimated_delivery_from,estimated_delivery_to)
  values(order_no,auth.uid(),left(trim(customer->>'customerName'),100),profile.email,left(trim(customer->>'customerPhone'),40),left(trim(customer->>'streetAddress'),200),nullif(left(trim(customer->>'addressLine2'),200),''),left(trim(customer->>'city'),100),left(trim(customer->>'postalCode'),20),left(trim(customer->>'country'),100),case when customer->>'shippingMethod'='EXPRESS' then 'EXPRESS' else 'STANDARD' end,0,shipping,shipping,'cod','pending','unfulfilled','pending','pending',request_key,current_date+case when customer->>'shippingMethod'='EXPRESS' then 1 else 3 end,current_date+case when customer->>'shippingMethod'='EXPRESS' then 2 else 5 end)
  returning id into order_id;
  for row_item in select * from jsonb_array_elements(items) loop
    quantity:=coalesce((row_item->>'qty')::integer,0);
    if quantity<1 or quantity>10 then raise exception 'Invalid quantity'; end if;
    select p.id,p.slug,p.name,p.price_pence into product_row from public.products p where p.slug=row_item->>'slug' and p.status='active';
    select v.* into variant_row from public.product_variants v where v.product_id=product_row.id and v.size=row_item->>'size' and v.color=row_item->>'color' and v.active for update;
    if variant_row.id is null or variant_row.stock<quantity then raise exception 'A selected product option is unavailable'; end if;
    update public.product_variants set stock=stock-quantity,updated_at=now() where id=variant_row.id and stock>=quantity;
    if not found then raise exception 'Insufficient stock'; end if;
    insert into public.order_items(order_id,product_slug,product_name,sku,size,color,quantity,unit_price_pence) values(order_id,product_row.slug,product_row.name,variant_row.sku,variant_row.size,variant_row.color,quantity,coalesce(variant_row.price_pence,product_row.price_pence));
    insert into public.inventory_movements(variant_id,order_id,quantity_delta,reason) values(variant_row.id,order_id,-quantity,'cod_order');
    subtotal:=subtotal+coalesce(variant_row.price_pence,product_row.price_pence)*quantity;
  end loop;
  update public.orders set subtotal_pence=subtotal,total_pence=subtotal+shipping where id=order_id;
  return jsonb_build_object('id',order_id,'orderNumber',order_no,'totalPence',subtotal+shipping);
end;
$$;
revoke all on function public.place_cod_order(jsonb,jsonb,text) from public;
grant execute on function public.place_cod_order(jsonb,jsonb,text) to authenticated;
