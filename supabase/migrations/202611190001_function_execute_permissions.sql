-- Supabase can grant EXECUTE directly to anon in addition to PostgreSQL PUBLIC.
-- These RPCs are staff operations. Their authenticated access and internal
-- role/MFA checks stay intact; existing service-role permissions are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

revoke execute on function public.is_admin_aal2(text[]) from public, anon;
revoke execute on function public.authorize_cancellation_email(uuid) from public, anon;
revoke execute on function public.cancel_pending_cod_order(uuid,text) from public, anon;
revoke execute on function public.mark_cod_collected(uuid) from public, anon;

grant execute on function public.is_admin_aal2(text[]) to authenticated;
grant execute on function public.authorize_cancellation_email(uuid) to authenticated;
grant execute on function public.cancel_pending_cod_order(uuid,text) to authenticated;
grant execute on function public.mark_cod_collected(uuid) to authenticated;

-- Future postgres-owned functions must opt in to browser execution. PUBLIC's
-- global default must be revoked globally; schema-only revocation cannot do it.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

commit;
