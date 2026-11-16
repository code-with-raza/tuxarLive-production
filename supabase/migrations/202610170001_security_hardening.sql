-- Apply before deploying the hardened Edge Functions. No customer records are deleted.
begin;

do $$ begin
  if to_regclass('public.admin_reporting_period') is null
    or to_regclass('public.media_assets') is null
    or to_regprocedure('public.place_cod_order(jsonb,jsonb,text)') is null
    or to_regprocedure('public.redeem_order_coupon(uuid,text)') is null then
    raise exception 'Required commerce migrations are missing, or this migration was already applied. No changes were committed.';
  end if;
end $$;

revoke create on schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

create table public.security_rate_limits (
  bucket_hash text primary key check (bucket_hash ~ '^[0-9a-f]{64}$'),
  requests integer not null,
  expires_at timestamptz not null
);
create index security_rate_limits_expiry_idx on public.security_rate_limits(expires_at);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated;
grant all on public.security_rate_limits to service_role;

create or replace function public.consume_security_rate_limit(bucket_key text, maximum_requests integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare hits integer;
begin
  if bucket_key !~ '^[0-9a-f]{64}$' or maximum_requests not between 1 and 1000 or window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit configuration';
  end if;
  delete from public.security_rate_limits where expires_at < now() - interval '1 day';
  insert into public.security_rate_limits as buckets(bucket_hash, requests, expires_at)
  values(bucket_key, 1, now() + make_interval(secs => window_seconds))
  on conflict(bucket_hash) do update set
    requests = case when buckets.expires_at <= now() then 1 else least(buckets.requests + 1, maximum_requests + 1) end,
    expires_at = case when buckets.expires_at <= now() then now() + make_interval(secs => window_seconds) else buckets.expires_at end
  returning requests into hits;
  return hits <= maximum_requests;
end $$;
revoke all on function public.consume_security_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text,integer,integer) to service_role;

-- All existing policies calling is_admin now require a verified second factor.
-- Staff can still read their own membership to complete MFA enrollment.
create or replace function public.is_admin(required_roles text[] default array['owner','admin'])
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
  and not exists(select 1 from public.customer_profiles where user_id=auth.uid() and account_status='disabled') and exists(
    select 1 from public.admin_users where user_id = auth.uid() and role = any(required_roles)
  );
$$;
revoke all on function public.is_admin(text[]) from public, anon;
grant execute on function public.is_admin(text[]) to authenticated;

create function public.is_active_customer()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.customer_profiles where user_id=auth.uid() and tuxar_verified and account_status='active');
$$;
revoke all on function public.is_active_customer() from public, anon;
grant execute on function public.is_active_customer() to authenticated;
revoke all on function public.create_pending_customer_profile() from public, anon, authenticated;

-- Private data has no anonymous grants; RLS remains the row ownership boundary.
revoke all on public.orders, public.order_items, public.customer_profiles,
  public.customer_otp_challenges, public.admin_users, public.admin_audit_log,
  public.contact_messages, public.newsletter_subscribers, public.marketing_campaigns,
  public.inventory_movements, public.admin_reporting_period from public, anon, authenticated;
grant select on public.orders, public.order_items, public.customer_profiles,
  public.inventory_movements, public.marketing_campaigns to authenticated;
grant select, insert, update, delete on public.admin_users to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant usage, select on sequence public.admin_audit_log_id_seq to authenticated;
grant select, update on public.admin_reporting_period to authenticated;
grant update(first_name,last_name,phone,updated_at) on public.customer_profiles to authenticated;
grant all on public.orders, public.order_items, public.customer_profiles,
  public.customer_otp_challenges, public.admin_users, public.admin_audit_log,
  public.contact_messages, public.newsletter_subscribers, public.marketing_campaigns,
  public.inventory_movements, public.admin_reporting_period to service_role;

drop policy if exists "admins update orders" on public.orders;
drop policy if exists "admins update orders with mfa" on public.orders;
drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders" on public.orders for select to authenticated
  using(user_id=auth.uid() and public.is_active_customer());
drop policy if exists "public reads active variants" on public.product_variants;
create policy "public reads active variants" on public.product_variants for select to anon, authenticated
  using(active and exists(select 1 from public.products p where p.id=product_id and p.status='active'));
drop policy if exists "public reads active media" on public.media_assets;
create policy "public reads website media" on public.media_assets for select to anon, authenticated using(status='active' and media_scope='website');
create policy "staff read all media" on public.media_assets for select to authenticated using(public.is_admin(array['owner','admin','editor']));

-- A customer's verification, email, and account state cannot be self-assigned.
create or replace function public.activate_email_customer_profile()
returns boolean language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare provider text; confirmed timestamptz;
begin
  select coalesce(raw_app_meta_data->>'provider','email'), email_confirmed_at into provider,confirmed from auth.users where id=auth.uid();
  if auth.uid() is null or provider <> 'email' or confirmed is null then raise exception 'Email verification is incomplete'; end if;
  update public.customer_profiles set tuxar_verified=true, verified_at=now(), account_status='active', updated_at=now()
    where user_id=auth.uid() and account_status <> 'disabled';
  return found;
end $$;
revoke all on function public.activate_email_customer_profile() from public, anon;
grant execute on function public.activate_email_customer_profile() to authenticated;

-- Lock the newest challenge, including consumed ones. Older codes never become valid again.
create or replace function public.consume_customer_otp(target_user uuid, supplied_hash text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare challenge public.customer_otp_challenges%rowtype;
begin
  if supplied_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if not exists(select 1 from public.customer_profiles where user_id=target_user and account_status <> 'disabled') then return false; end if;
  select * into challenge from public.customer_otp_challenges where user_id=target_user order by created_at desc, id desc limit 1 for update;
  if challenge.id is null or challenge.consumed_at is not null or challenge.expires_at <= now() or challenge.attempts >= 5 then return false; end if;
  update public.customer_otp_challenges set attempts=attempts+1,
    consumed_at=case when code_hash=supplied_hash then now() else null end where id=challenge.id;
  return challenge.code_hash=supplied_hash;
end $$;
revoke all on function public.consume_customer_otp(uuid,text) from public, anon, authenticated;
grant execute on function public.consume_customer_otp(uuid,text) to service_role;

create or replace function public.mark_order_fulfilled(target_order uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare target public.orders%rowtype;
begin
  if not public.is_admin(array['owner','admin','fulfilment']) then raise exception 'Staff permission required'; end if;
  select * into target from public.orders where id=target_order for update;
  if target.id is null or target.order_status <> 'dispatched' or (target.payment_method='stripe' and target.payment_status <> 'paid') then
    raise exception 'Only dispatched, eligible orders can be fulfilled';
  end if;
  update public.orders set fulfilment_status='fulfilled', order_status='fulfilled', fulfilled_at=now(), updated_at=now() where id=target.id;
  insert into public.admin_audit_log(admin_user_id,action,resource_type,resource_id)
    values(auth.uid(),'order.fulfilled','orders',target.id::text);
end $$;
revoke all on function public.mark_order_fulfilled(uuid) from public, anon;
grant execute on function public.mark_order_fulfilled(uuid) to authenticated;

-- Preserve the existing transactional stock/order implementation behind a checked entry point.
alter function public.place_cod_order(jsonb,jsonb,text) rename to place_cod_order_internal;
revoke all on function public.place_cod_order_internal(jsonb,jsonb,text) from public, anon, authenticated;

create function public.place_cod_order_for_user(customer jsonb, items jsonb, request_key text, customer_user uuid, coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare existing public.orders%rowtype; field_name text; field_limit integer; result jsonb; discount jsonb;
begin
  if customer_user is null or request_key is null or request_key !~ '^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$' then raise exception 'Invalid checkout request'; end if;
  if jsonb_typeof(customer) is distinct from 'object' or jsonb_typeof(items) is distinct from 'array' then raise exception 'Invalid checkout details'; end if;
  if jsonb_array_length(items) not between 1 and 20 then raise exception 'Invalid cart'; end if;
  for field_name,field_limit in select * from (values ('customerName',100),('customerPhone',40),('streetAddress',200),('city',100),('postalCode',20),('country',100)) as required_fields(name,max_length) loop
    if jsonb_typeof(customer->field_name) is distinct from 'string' or length(trim(customer->>field_name)) not between 1 and field_limit then raise exception 'Invalid shipping details'; end if;
  end loop;
  if lower(trim(customer->>'country')) not in ('gb','uk','united kingdom') then raise exception 'UK delivery only'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key,0));
  select * into existing from public.orders where idempotency_key=request_key;
  if existing.id is not null and existing.user_id is distinct from customer_user then raise exception 'Invalid checkout request'; end if;
  perform set_config('request.jwt.claim.sub',customer_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',customer_user,'role','authenticated','aal','aal1')::text,true);
  result := public.place_cod_order_internal(customer,items,request_key);
  if nullif(trim(coupon_code),'') is not null and existing.id is null then
    discount := public.redeem_order_coupon_for_user((result->>'id')::uuid,coupon_code,customer_user);
    result := result || jsonb_build_object('totalPence',discount->'totalPence','discountPence',discount->'discountPence','couponCode',discount->'code');
  end if;
  return result;
end $$;
revoke all on function public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text) from public, anon, authenticated;
grant execute on function public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text) to service_role;

-- Discounts may only change an unpaid, unfulfilled order before a Stripe session is issued.
alter function public.redeem_order_coupon(uuid,text) rename to redeem_order_coupon_internal;
revoke all on function public.redeem_order_coupon_internal(uuid,text) from public, anon, authenticated;
create function public.redeem_order_coupon_for_user(target_order uuid, supplied_code text, customer_user uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare target public.orders%rowtype;
begin
  if customer_user is null or supplied_code !~ '^[A-Za-z0-9_-]{3,32}$' then raise exception 'Invalid coupon request'; end if;
  select * into target from public.orders where id=target_order and user_id=customer_user for update;
  if target.id is null or target.payment_status <> 'pending' or target.order_status <> 'pending' or target.stripe_checkout_session_id is not null then
    raise exception 'This order cannot be discounted';
  end if;
  perform set_config('request.jwt.claim.sub',customer_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',customer_user,'role','authenticated','aal','aal1')::text,true);
  return public.redeem_order_coupon_internal(target_order,supplied_code);
end $$;
revoke all on function public.redeem_order_coupon_for_user(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.redeem_order_coupon_for_user(uuid,text,uuid) to service_role;
revoke all on function public.preview_coupon(text,integer) from public, anon;
grant execute on function public.preview_coupon(text,integer) to authenticated;

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null check(length(first_name) between 1 and 100),
  last_name text not null check(length(last_name) between 1 and 100),
  phone text not null check(length(phone) between 6 and 40),
  street_address text not null check(length(street_address) between 5 and 200),
  city text not null check(length(city) between 2 and 100),
  postal_code text not null check(length(postal_code) between 3 and 20),
  country text not null check(length(country) between 2 and 100),
  address_type text not null check(address_type in ('SHIPPING','BILLING')),
  created_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses(user_id);
alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant all on public.customer_addresses to service_role;
create policy "customers manage own addresses" on public.customer_addresses for all to authenticated
  using(user_id=auth.uid() and public.is_active_customer()) with check(user_id=auth.uid() and exists(
    select 1 from public.customer_profiles where user_id=auth.uid() and tuxar_verified and account_status='active'
  ));

commit;
