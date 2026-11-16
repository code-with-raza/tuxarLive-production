-- Additive follow-up. Never edit/replay a potentially applied historical migration.
-- Review the production ledger and back up first; deploy only with owner approval.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if to_regprocedure('public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)') is null
    or to_regclass('public.customer_addresses') is null then
    raise exception 'Apply and verify 202610170001_security_hardening first';
  end if;
end $$;

-- Explicit minimum grants: do not depend on a project's historical default grants.
-- RLS still restricts writes to staff with the appropriate role and AAL2.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.products, public.product_variants, public.product_images,
  public.product_collections, public.product_categories, public.blog_posts,
  public.media_assets to anon, authenticated;
grant insert, update, delete on public.products, public.product_variants,
  public.product_images, public.product_collections, public.product_categories,
  public.blog_posts, public.media_assets to authenticated;
grant select, insert, update, delete on public.coupons, public.marketing_templates to authenticated;
grant all on public.products, public.product_variants, public.product_images,
  public.product_collections, public.product_categories, public.blog_posts,
  public.media_assets, public.coupons, public.marketing_templates to service_role;

-- These indexes change no prices, catalogue rows, stock, users or orders.
-- Creation can briefly lock writes; the timeouts abort rather than wait indefinitely.
create index if not exists orders_stripe_refund_id_idx
  on public.orders(stripe_refund_id) where stripe_refund_id is not null;
create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements(order_id);
create index if not exists product_variants_selection_idx
  on public.product_variants(product_id,size,color);

-- Prevent a dispatch/refund race without holding a database lock over a network call.
-- A failed/ambiguous external request remains reserved for review or idempotent retry.
create function public.prepare_stripe_cancellation(target_order uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target public.orders%rowtype;
begin
  if not public.is_admin(array['owner','admin']) then raise exception 'Refund permission and MFA required'; end if;
  select * into target from public.orders where id=target_order for update;
  if target.id is null or target.payment_method <> 'stripe' or target.payment_status <> 'paid'
    or target.order_status <> 'pending' or target.stripe_payment_intent_id is null
    or target.stripe_refund_id is not null then
    raise exception 'Only pending, paid Stripe orders can be reserved for cancellation';
  end if;
  update public.orders set refund_status='requested',updated_at=now() where id=target.id;
end $$;
revoke all on function public.prepare_stripe_cancellation(uuid) from public,anon;
grant execute on function public.prepare_stripe_cancellation(uuid) to authenticated;

commit;
