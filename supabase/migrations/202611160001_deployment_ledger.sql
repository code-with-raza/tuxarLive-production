-- Private release history: replaying a deployment must never reset admin prices,
-- sold inventory, archived products, or image selections.
create schema if not exists deployment;
revoke all on schema deployment from public, anon, authenticated;
create table if not exists deployment.catalogue_releases (
  id text primary key,
  digest text not null,
  applied_at timestamptz not null default now()
);
revoke all on deployment.catalogue_releases from public, anon, authenticated;
