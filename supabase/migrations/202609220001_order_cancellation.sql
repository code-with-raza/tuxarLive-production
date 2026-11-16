alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_email_sent_at timestamptz;

create or replace function public.cancel_pending_cod_order(target_order uuid, reason text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  target public.orders%rowtype;
  movement record;
  clean_reason text := left(trim(coalesce(reason, '')), 500);
begin
  if not public.is_admin(array['owner', 'admin', 'fulfilment']) then
    raise exception 'Staff permission required';
  end if;
  if length(clean_reason) < 10 then
    raise exception 'Please provide a clear cancellation reason (at least 10 characters)';
  end if;

  select * into target from public.orders where id = target_order for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if target.payment_method <> 'cod' or target.payment_status <> 'pending'
     or target.order_status <> 'pending' then
    raise exception 'Only pending, unpaid COD orders can be cancelled here';
  end if;

  -- COD inventory is reserved when the order is created. Reverse each reservation once.
  for movement in
    select variant_id, -sum(quantity_delta)::integer as quantity
    from public.inventory_movements
    where order_id = target.id and reason = 'cod_order'
    group by variant_id
  loop
    update public.product_variants
    set stock = stock + movement.quantity, updated_at = now()
    where id = movement.variant_id;
    insert into public.inventory_movements(variant_id, order_id, quantity_delta, reason)
    values(movement.variant_id, target.id, movement.quantity, 'cod_cancellation');
  end loop;

  if target.coupon_id is not null then
    update public.coupons
    set usage_count = greatest(0, usage_count - 1), updated_at = now()
    where id = target.coupon_id;
  end if;

  update public.orders
  set order_status = 'cancelled', fulfilment_status = 'cancelled',
      cod_status = 'cancelled', cancellation_reason = clean_reason,
      cancelled_at = now(), updated_at = now()
  where id = target.id;

  insert into public.admin_audit_log(admin_user_id, action, resource_type, resource_id, details)
  values(auth.uid(), 'order.cancelled', 'orders', target.id,
         jsonb_build_object('reason', clean_reason, 'order_number', target.order_number));

  return jsonb_build_object('id', target.id, 'orderNumber', target.order_number);
end;
$$;
revoke all on function public.cancel_pending_cod_order(uuid, text) from public;
grant execute on function public.cancel_pending_cod_order(uuid, text) to authenticated;

create or replace function public.mark_cod_collected(target_order uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare target public.orders%rowtype;
begin
  if not public.is_admin(array['owner', 'admin', 'fulfilment']) then
    raise exception 'Staff permission required';
  end if;
  select * into target from public.orders where id = target_order for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if target.payment_method <> 'cod' or target.order_status <> 'fulfilled'
     or target.cod_status <> 'pending' or target.payment_status <> 'pending' then
    raise exception 'Only fulfilled COD orders awaiting cash can be marked collected';
  end if;
  update public.orders
  set cod_status = 'collected', payment_status = 'paid', paid_at = now(), updated_at = now()
  where id = target.id;
  insert into public.admin_audit_log(admin_user_id, action, resource_type, resource_id, details)
  values(auth.uid(), 'order.cod_collected', 'orders', target.id,
         jsonb_build_object('order_number', target.order_number));
end;
$$;
revoke all on function public.mark_cod_collected(uuid) from public;
grant execute on function public.mark_cod_collected(uuid) to authenticated;
