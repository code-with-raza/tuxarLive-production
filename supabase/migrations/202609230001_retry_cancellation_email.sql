create or replace function public.authorize_cancellation_email(target_order uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin(array['owner', 'admin', 'fulfilment']) then
    raise exception 'Staff permission required';
  end if;
  if not exists (
    select 1 from public.orders
    where id = target_order and payment_method = 'cod'
      and order_status = 'cancelled' and cancellation_email_sent_at is null
  ) then
    raise exception 'This order is not awaiting a cancellation email';
  end if;
  return true;
end;
$$;
revoke all on function public.authorize_cancellation_email(uuid) from public;
grant execute on function public.authorize_cancellation_email(uuid) to authenticated;
