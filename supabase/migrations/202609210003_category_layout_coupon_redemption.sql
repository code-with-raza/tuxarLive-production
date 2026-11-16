alter table public.product_categories add column if not exists audience text not null default 'both' check (audience in ('men','women','both'));
alter table public.product_categories add column if not exists show_hero boolean not null default true;
alter table public.product_categories add column if not exists show_description boolean not null default true;
alter table public.product_categories add column if not exists show_product_count boolean not null default true;
alter table public.product_categories add column if not exists show_filters boolean not null default true;

alter table public.orders add column if not exists coupon_id uuid references public.coupons(id);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_pence integer not null default 0 check (discount_pence >= 0);

create or replace function public.redeem_order_coupon(target_order uuid, supplied_code text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare c public.coupons%rowtype; o public.orders%rowtype; discount integer;
begin
  select * into o from public.orders where id=target_order and user_id=auth.uid() for update;
  if o.id is null then raise exception 'Order not found'; end if;
  if o.coupon_id is not null then raise exception 'A coupon is already applied'; end if;
  select * into c from public.coupons where code=upper(trim(supplied_code)) for update;
  if c.id is null or c.status<>'active' then raise exception 'Invalid coupon code'; end if;
  if c.starts_at is not null and now()<c.starts_at then raise exception 'This coupon is not active yet'; end if;
  if c.expires_at is not null and now()>=c.expires_at then raise exception 'This coupon has expired'; end if;
  if c.usage_limit is not null and c.usage_count>=c.usage_limit then raise exception 'This coupon has reached its usage limit'; end if;
  if o.subtotal_pence<c.minimum_order_pence then raise exception 'Minimum order value is not met'; end if;
  discount:=case when c.discount_type='percentage' then floor(o.subtotal_pence*c.discount_value/100.0)::integer else c.discount_value end;
  if c.maximum_discount_pence is not null then discount:=least(discount,c.maximum_discount_pence); end if;
  discount:=least(discount,o.subtotal_pence);
  update public.orders set coupon_id=c.id,coupon_code=c.code,discount_pence=discount,total_pence=subtotal_pence+shipping_pence-discount,updated_at=now() where id=o.id;
  update public.coupons set usage_count=usage_count+1,updated_at=now() where id=c.id;
  return jsonb_build_object('code',c.code,'discountPence',discount,'totalPence',o.subtotal_pence+o.shipping_pence-discount);
end $$;
revoke all on function public.redeem_order_coupon(uuid,text) from public;
grant execute on function public.redeem_order_coupon(uuid,text) to authenticated;

create or replace function public.preview_coupon(supplied_code text, subtotal_pence integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.coupons%rowtype; discount integer;
begin
 select * into c from public.coupons where code=upper(trim(supplied_code));
 if c.id is null or c.status<>'active' then raise exception 'Invalid coupon code'; end if;
 if c.starts_at is not null and now()<c.starts_at then raise exception 'This coupon is not active yet'; end if;
 if c.expires_at is not null and now()>=c.expires_at then raise exception 'This coupon has expired'; end if;
 if c.usage_limit is not null and c.usage_count>=c.usage_limit then raise exception 'This coupon has reached its usage limit'; end if;
 if subtotal_pence<c.minimum_order_pence then raise exception 'Minimum order value is not met'; end if;
 discount:=case when c.discount_type='percentage' then floor(subtotal_pence*c.discount_value/100.0)::integer else c.discount_value end;
 if c.maximum_discount_pence is not null then discount:=least(discount,c.maximum_discount_pence); end if;
 return jsonb_build_object('code',c.code,'discountPence',least(discount,subtotal_pence));
end $$;
grant execute on function public.preview_coupon(text,integer) to authenticated;
