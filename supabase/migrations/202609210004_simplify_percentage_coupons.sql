-- Coupon management now uses percentage + minimum basket value only.
-- Remove the legacy cap from the explicitly identified coupon.
update public.coupons
set maximum_discount_pence = null,
    updated_at = now()
where code = '1234';
