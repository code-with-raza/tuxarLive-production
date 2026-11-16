alter table public.orders add column if not exists stripe_refund_id text;
alter table public.orders add column if not exists refund_status text;
alter table public.orders add column if not exists refund_email_sent_at timestamptz;

create or replace function public.finalize_stripe_cancellation(
  target_order uuid, staff_user uuid, cancellation_text text,
  refund_id text, refund_state text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.orders%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if refund_id !~ '^re_[A-Za-z0-9]+$' or refund_state not in ('pending','succeeded') then
    raise exception 'Invalid Stripe refund';
  end if;
  select * into target from public.orders where id = target_order for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if target.order_status = 'cancelled' and target.stripe_refund_id = refund_id then
    return jsonb_build_object('id', target.id, 'orderNumber', target.order_number);
  end if;
  if target.payment_method <> 'stripe' or target.payment_status <> 'paid'
     or target.order_status <> 'pending' or target.stripe_payment_intent_id is null then
    raise exception 'Only pending, paid Stripe orders can be cancelled';
  end if;
  update public.orders set order_status = 'cancelled', fulfilment_status = 'cancelled',
    payment_status = case when refund_state = 'succeeded' then 'refunded' else 'paid' end,
    stripe_refund_id = refund_id, refund_status = refund_state,
    cancellation_reason = left(cancellation_text, 500), cancelled_at = now(), updated_at = now()
    where id = target.id;
  if target.coupon_id is not null then
    update public.coupons set usage_count = greatest(0, usage_count - 1), updated_at = now()
    where id = target.coupon_id;
  end if;
  insert into public.admin_audit_log(admin_user_id, action, resource_type, resource_id, details)
  values(staff_user, 'order.cancelled_refund_requested', 'orders', target.id,
    jsonb_build_object('refund_id', refund_id, 'refund_status', refund_state));
  return jsonb_build_object('id', target.id, 'orderNumber', target.order_number);
end;
$$;
revoke all on function public.finalize_stripe_cancellation(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.finalize_stripe_cancellation(uuid,uuid,text,text,text) to service_role;
