-- MFA can be re-enabled later without changing the admin role model.
-- Password authentication remains managed and hashed by Supabase Auth.

drop policy if exists "admins read orders with mfa" on public.orders;
drop policy if exists "admins update orders with mfa" on public.orders;
drop policy if exists "admins read order items with mfa" on public.order_items;
drop policy if exists "owners manage staff with mfa" on public.admin_users;
drop policy if exists "admins read audit log with mfa" on public.admin_audit_log;
drop policy if exists "admins create audit entries with mfa" on public.admin_audit_log;

create policy "admins read orders" on public.orders
  for select to authenticated using (public.is_admin(array['owner','admin','fulfilment']));
create policy "admins update orders" on public.orders
  for update to authenticated using (public.is_admin(array['owner','admin','fulfilment']))
  with check (public.is_admin(array['owner','admin','fulfilment']));
create policy "admins read order items" on public.order_items
  for select to authenticated using (public.is_admin(array['owner','admin','fulfilment']));
create policy "owners manage staff" on public.admin_users
  for all to authenticated using (public.is_admin(array['owner']))
  with check (public.is_admin(array['owner']));
create policy "admins read audit log" on public.admin_audit_log
  for select to authenticated using (public.is_admin(array['owner','admin']));
create policy "admins create audit entries" on public.admin_audit_log
  for insert to authenticated with check (
    admin_user_id = auth.uid() and public.is_admin(array['owner','admin','fulfilment'])
  );
