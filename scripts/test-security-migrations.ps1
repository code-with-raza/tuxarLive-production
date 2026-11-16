param([string]$PgBin='F:\postgresql-17.11-5-windows-x64-binaries\pgsql\bin')
$ErrorActionPreference='Stop'
$testRef='kiwpvindkuponqwgmneq'
$testHost='aws-0-eu-west-1.pooler.supabase.com'
$testUser='postgres.kiwpvindkuponqwgmneq'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$psqlPath=Join-Path $PgBin 'psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) { throw 'PostgreSQL tools missing.' }
if ($testUser -cne ('postgres.'+$testRef) -or $testRef -eq 'ncgxljatjajgcvnlrncm') { throw 'Refused target.' }
Write-Output ('TEST ONLY: '+$testRef+' / '+$testHost)
Write-Output 'Applies both reviewed security migrations and checks data preservation, permissions, MFA and rate limiting.'
Write-Output 'No production connection, emails, payments or fake orders. Keep test APIs/providers disabled.'
if ((Read-Host ('Type '+$testRef+' to confirm TEST security migration')) -cne $testRef) { throw 'Cancelled; nothing changed.' }

function Read-MigrationBody([string]$RelativePath) {
  $migrationText=[IO.File]::ReadAllText((Join-Path $projectRoot $RelativePath)).Replace("`r`n","`n")
  if ([regex]::Matches($migrationText,'(?im)^begin;[ \t]*$').Count -ne 1 -or [regex]::Matches($migrationText,'(?im)^commit;[ \t]*$').Count -ne 1) { throw 'Unexpected migration transaction framing. Stop for review.' }
  return ($migrationText -replace '(?im)^begin;[ \t]*$','' -replace '(?im)^commit;[ \t]*$','')
}
$first=Read-MigrationBody 'supabase/migrations/202610170001_security_hardening.sql'
$second=Read-MigrationBody 'supabase/migrations/202610170002_security_release_safety.sql'
$preflight=@'
\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtext('tuxar-test-security-migrations'));
do $guard$
begin
  if to_regclass('public.products') is null or to_regclass('public.orders') is null
    or (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') <> 20 then
    raise exception 'Expected restored application schema. Stop for review.';
  end if;
  if to_regclass('public.security_rate_limits') is not null or to_regclass('public.customer_addresses') is not null
    or to_regprocedure('public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)') is not null then
    raise exception 'Security objects already exist. Do not rerun; inspect state.';
  end if;
end;
$guard$;
create temporary table tuxar_before(table_name text primary key, fingerprint text) on commit drop;
do $snapshot$
declare tab record; digest text;
begin
  for tab in select tablename from pg_tables where schemaname='public' loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), %L order by md5(to_jsonb(t)::text)), %L)) from public.%I t','','',tab.tablename) into digest;
    insert into tuxar_before values(tab.tablename,digest);
  end loop;
end;
$snapshot$;
'@
$verification=@'
do $checks$
declare tab record; digest text;
begin
  for tab in select * from tuxar_before loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), %L order by md5(to_jsonb(t)::text)), %L)) from public.%I t','','',tab.table_name) into digest;
    if digest is distinct from tab.fingerprint then raise exception 'Existing data changed: %',tab.table_name; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid='public.customer_addresses'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.security_rate_limits'::regclass) then
    raise exception 'Required RLS missing';
  end if;
  if has_table_privilege('anon','public.orders','SELECT')
    or has_table_privilege('anon','public.customer_profiles','SELECT')
    or has_table_privilege('anon','public.customer_addresses','SELECT')
    or has_table_privilege('anon','public.security_rate_limits','SELECT')
    or has_table_privilege('authenticated','public.orders','UPDATE') then
    raise exception 'Unexpected private table privilege';
  end if;
  if has_function_privilege('anon','public.place_cod_order_internal(jsonb,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.place_cod_order_internal(jsonb,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.consume_security_rate_limit(text,integer,integer)','EXECUTE') then
    raise exception 'Unexpected privileged RPC access';
  end if;
  if not has_function_privilege('service_role','public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.consume_security_rate_limit(text,integer,integer)','EXECUTE')
    or not has_table_privilege('anon','public.products','SELECT')
    or not has_function_privilege('authenticated','public.prepare_stripe_cancellation(uuid)','EXECUTE') then
    raise exception 'Required legitimate privilege missing';
  end if;
end;
$checks$;
-- Claims are local SQL-test context, not issued JWTs or actual sign-ins.
savepoint tuxar_security_probes;
do $mfa$
declare staff_id uuid;
begin
  select a.user_id into staff_id from public.admin_users a
    where a.role in ('owner','admin') and not exists(select 1 from public.customer_profiles p where p.user_id=a.user_id and p.account_status='disabled') limit 1;
  if staff_id is null then raise exception 'No enabled staff member for MFA policy test; stop for review'; end if;
  perform set_config('request.jwt.claim.sub',staff_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated','aal','aal1')::text,true);
  if public.is_admin(array['owner','admin']) then raise exception 'Staff passed without MFA'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated','aal','aal2')::text,true);
  if not public.is_admin(array['owner','admin']) then raise exception 'Enabled staff rejected with MFA'; end if;
end;
$mfa$;
set local role anon;
do $anonymous$
begin
  begin
    perform 1 from public.orders limit 1;
    raise exception 'Anonymous private read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform 1 from public.products limit 1;
end;
$anonymous$;
reset role;
set local role service_role;
do $limiter$
begin
  if not public.consume_security_rate_limit(repeat('a',64),1,60) then raise exception 'Limiter rejected first request'; end if;
  if public.consume_security_rate_limit(repeat('a',64),1,60) then raise exception 'Limiter allowed over-limit request'; end if;
end;
$limiter$;
reset role;
rollback to savepoint tuxar_security_probes;
release savepoint tuxar_security_probes;
commit;
select 'TEST SECURITY MIGRATIONS COMMITTED; DATA AND CORE GUARDS VERIFIED' as result;
'@
$outputPath=Join-Path $projectRoot ('output/security-test-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $outputPath -ErrorAction Stop | Out-Null
$sqlPath=Join-Path $outputPath 'test-security.sql'
[IO.File]::WriteAllText($sqlPath,($preflight+"`n"+$first+"`n"+$second+"`n"+$verification),[Text.UTF8Encoding]::new($false))
$connection="host=$testHost port=5432 dbname=postgres user=$testUser sslmode=require connect_timeout=15 application_name=tuxar-test-security-migrations"
Write-Output 'Enter the TEST database password only.'
& $psqlPath $connection -X -W -v ON_ERROR_STOP=1 --file $sqlPath
if ($LASTEXITCODE -ne 0) { throw 'Test migration failed/disconnected. Stop and inspect target state; do not bypass checks or run production SQL.' }
Write-Output 'TEST ONLY completed. No migration ledger repair or production deployment was performed.'
