begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Disable new COD orders without deleting functions, orders or payment history.
-- Online Stripe order functions and existing-order administration are unchanged.
do $$
declare
  signature text;
  target regprocedure;
begin
  foreach signature in array array[
    'public.place_cod_order(jsonb,jsonb,text)',
    'public.place_cod_order_internal(jsonb,jsonb,text)',
    'public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)'
  ] loop
    target := to_regprocedure(signature);
    if target is not null then
      execute format('revoke execute on function %s from public, anon, authenticated, service_role', target);
    end if;
  end loop;
end;
$$;

commit;
