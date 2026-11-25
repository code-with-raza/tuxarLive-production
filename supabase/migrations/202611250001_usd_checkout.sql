-- Add USD presentment without rewriting catalogue prices or historical orders.
begin;
alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check (currency in ('GBP','EUR','USD'));
alter table public.orders add column usd_rate_e8 bigint;
alter table public.orders add column usd_rate_date date;
alter table public.orders add column base_subtotal_pence integer;
alter table public.orders add constraint orders_usd_rate_check check (
  currency <> 'USD' or (usd_rate_e8 is not null and usd_rate_e8 between 1000000 and 10000000000
    and usd_rate_date is not null and base_subtotal_pence is not null and base_subtotal_pence >= 0)
);

create function public.preview_usd_coupon(supplied_code text, base_subtotal_pence integer, usd_subtotal_cents integer, rate_e8 bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.coupons%rowtype; discount integer;
begin
 if base_subtotal_pence is null or base_subtotal_pence < 0 or usd_subtotal_cents is null or usd_subtotal_cents < 0
    or rate_e8 is null or rate_e8 not between 1000000 and 10000000000 then raise exception 'Invalid USD coupon preview'; end if;
 select * into c from public.coupons where code=upper(trim(supplied_code));
 if c.id is null or c.status<>'active' then raise exception 'Invalid coupon code'; end if;
 if c.starts_at is not null and now()<c.starts_at then raise exception 'This coupon is not active yet'; end if;
 if c.expires_at is not null and now()>=c.expires_at then raise exception 'This coupon has expired'; end if;
 if c.usage_limit is not null and c.usage_count>=c.usage_limit then raise exception 'This coupon has reached its usage limit'; end if;
 if base_subtotal_pence<c.minimum_order_pence then raise exception 'Minimum order value is not met'; end if;
 discount:=case when c.discount_type='percentage' then floor(usd_subtotal_cents::numeric*c.discount_value/100)::integer
   else round(c.discount_value::numeric*rate_e8/100000000)::integer end;
 if c.maximum_discount_pence is not null then discount:=least(discount,round(c.maximum_discount_pence::numeric*rate_e8/100000000)::integer); end if;
 return jsonb_build_object('code',c.code,'discountPence',least(discount,usd_subtotal_cents),'discountPercent',case when c.discount_type='percentage' then c.discount_value else null end);
end $$;
revoke all on function public.preview_usd_coupon(text,integer,integer,bigint) from public,anon;
grant execute on function public.preview_usd_coupon(text,integer,integer,bigint) to authenticated,service_role;

create or replace function public.redeem_order_coupon_internal(target_order uuid, supplied_code text)
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
 if o.currency='USD' then
   discount:=(public.preview_usd_coupon(supplied_code,o.base_subtotal_pence,o.subtotal_pence,o.usd_rate_e8)->>'discountPence')::integer;
 else
   if o.subtotal_pence<c.minimum_order_pence then raise exception 'Minimum order value is not met'; end if;
   discount:=case when c.discount_type='percentage' then floor(o.subtotal_pence*c.discount_value/100.0)::integer else c.discount_value end;
   if c.maximum_discount_pence is not null then discount:=least(discount,c.maximum_discount_pence); end if;
   discount:=least(discount,o.subtotal_pence);
 end if;
 update public.orders set coupon_id=c.id,coupon_code=c.code,discount_pence=discount,total_pence=subtotal_pence+shipping_pence-discount,updated_at=now() where id=o.id;
 update public.coupons set usage_count=usage_count+1,updated_at=now() where id=c.id;
 return jsonb_build_object('code',c.code,'discountPence',discount,'totalPence',o.subtotal_pence+o.shipping_pence-discount);
end $$;
revoke all on function public.redeem_order_coupon_internal(uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_order_coupon_internal(uuid,text) to service_role;
commit;
