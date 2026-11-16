create table if not exists public.admin_reporting_period (
  id integer primary key default 1 check (id = 1),
  started_at timestamptz not null default '1970-01-01T00:00:00Z',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.admin_reporting_period(id) values (1) on conflict (id) do nothing;
alter table public.admin_reporting_period enable row level security;
create policy "staff read reporting period" on public.admin_reporting_period
  for select to authenticated using (public.is_admin(array['owner','admin']));
create policy "owner update reporting period" on public.admin_reporting_period
  for update to authenticated using (public.is_admin(array['owner']))
  with check (public.is_admin(array['owner']));
grant select, update on public.admin_reporting_period to authenticated;
