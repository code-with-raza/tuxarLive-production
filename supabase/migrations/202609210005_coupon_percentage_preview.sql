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
 return jsonb_build_object('code',c.code,'discountPence',least(discount,subtotal_pence),'discountPercent',case when c.discount_type='percentage' then c.discount_value else null end);
end $$;
