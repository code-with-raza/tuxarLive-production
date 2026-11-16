import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const TEST_REF = 'kiwpvindkuponqwgmneq';
export const TEST_HOST = 'aws-0-eu-west-1.pooler.supabase.com';
const PUBLIC_KINDS = ['FUNCTION','TABLE','SEQUENCE','SEQUENCE OWNED BY','TABLE DATA','SEQUENCE SET','CONSTRAINT','INDEX','FK CONSTRAINT','ROW SECURITY','POLICY','DEFAULT ACL','ACL','COMMENT','TYPE'];

export function selectRestoreEntries(toc) {
  const entries = toc.split(/\r?\n/).filter(line => {
    if (/^\d+; \d+ \d+ TABLE DATA auth (users|identities) supabase_auth_admin$/.test(line)) return true;
    if (/^\d+; \d+ \d+ TRIGGER auth users on_auth_user_created_customer_profile supabase_auth_admin$/.test(line)) return true;
    const match = line.match(/^\d+; \d+ \d+ (.+?) public (.+) postgres$/);
    if (!match || !PUBLIC_KINDS.includes(match[1])) return false;
    // Retain the schema, but do not activate copied production OTP challenges.
    return !(match[1] === 'TABLE DATA' && match[2] === 'customer_otp_challenges');
  });
  // Managed Auth constraints already exist in the target. Their definitions were
  // deliberately excluded, so pg_restore cannot infer this dependency for us.
  const usersIndex = entries.findIndex(line => line.includes(' TABLE DATA auth users '));
  const identitiesIndex = entries.findIndex(line => line.includes(' TABLE DATA auth identities '));
  if (usersIndex > identitiesIndex && identitiesIndex >= 0) {
    const [users] = entries.splice(usersIndex, 1);
    entries.splice(identitiesIndex, 0, users);
  }
  return entries;
}

export function copyCounts(sql) {
  const rows = [];
  const lines = sql.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const copy = lines[index].match(/^COPY (public|auth)\.([a-z_]+) \(.+\) FROM stdin;$/);
    if (!copy) continue;
    let count = 0;
    while (++index < lines.length && lines[index] !== '\\.') count++;
    if (index === lines.length) throw new Error('Incomplete COPY block; nothing restored.');
    rows.push({schema:copy[1],table:copy[2],count});
  }
  return rows;
}

export function restoreSql(sql, counts, tableCount, policyCount) {
  if (/^\\connect\b/im.test(sql)) throw new Error('Unexpected database switch in archive.');
  const assertCounts = counts.map(({schema,table,count}) =>
    `  if (select count(*) from ${schema}.${table}) <> ${count} then raise exception 'Count mismatch: ${schema}.${table}'; end if;`).join('\n');
  return `\\set ON_ERROR_STOP on
-- TARGET: isolated Tuxar Restore Test only. No production credentials in this file.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtext('tuxar-isolated-restore-test'));
do $tuxar_preflight$
begin
  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Expected PostgreSQL major version 17';
  end if;
  if exists(select 1 from information_schema.tables where table_schema='public' and table_type='BASE TABLE')
    or exists(select 1 from auth.users) or exists(select 1 from auth.identities) then
    raise exception 'Target is not empty. Stop and preserve all existing objects.';
  end if;
  if not exists(select 1 from pg_roles where rolname='anon')
    or not exists(select 1 from pg_roles where rolname='authenticated')
    or not exists(select 1 from pg_roles where rolname='service_role') then
    raise exception 'Expected Supabase roles are missing';
  end if;
  if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal) then
    raise exception 'Unexpected existing Auth trigger; review before restore';
  end if;
  if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='citext' and n.nspname <> 'public') then
    raise exception 'citext exists outside public; review extension placement';
  end if;
end;
$tuxar_preflight$;
create extension if not exists citext with schema public;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- Prevent target-specific defaults adding privileges absent from the source ACLs.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres revoke execute on functions from public;
${sql}
-- Sanitise the TEST copy only: never reuse production credentials or action tokens.
-- The original dump is unchanged. This does not test credential continuity.
update auth.users set encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'));
do $tuxar_tokens$
declare token_column text;
begin
  foreach token_column in array array['confirmation_token','recovery_token','email_change_token_new','email_change_token_current','phone_change_token','reauthentication_token','email_change','phone_change'] loop
    if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name=token_column) then
      execute format('update auth.users set %I = %L', token_column, '');
    end if;
  end loop;
end;
$tuxar_tokens$;
do $tuxar_verify$
begin
${assertCounts}
  if (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') <> ${tableCount} then
    raise exception 'Application table count mismatch';
  end if;
  if (select count(*) from pg_policies where schemaname='public') <> ${policyCount} then
    raise exception 'Application policy count mismatch';
  end if;
end;
$tuxar_verify$;
commit;
select 'SELECTIVE RESTORE COMMITTED; COUNTS VERIFIED' as result;
`;
}

function runTool(tool, args) {
  const result = spawnSync(tool, args, {encoding:'utf8', maxBuffer:64*1024*1024, windowsHide:true});
  if (result.error || result.status !== 0) {
    // Do not print archive SQL/data or tool diagnostics containing private records.
    throw new Error('Offline archive preparation failed; nothing was sent to Supabase.');
  }
  return result.stdout;
}

export function prepare({backup, pgBin, output}) {
  const absoluteBackup = fs.realpathSync(backup);
  const privateRoot = path.dirname(absoluteBackup);
  const resolvedOutput = path.resolve(output);
  if (path.dirname(resolvedOutput).toLowerCase() !== privateRoot.toLowerCase()) throw new Error('Output must be a new subfolder beside the private backup.');
  if (fs.existsSync(resolvedOutput)) throw new Error('Output folder exists. Choose a fresh folder; never overwrite a backup.');
  const pgRestore = path.join(pgBin,'pg_restore.exe');
  if (!/\b17\.\d+/.test(runTool(pgRestore,['--version']))) throw new Error('Use PostgreSQL 17 tools.');
  const toc = runTool(pgRestore,['--list',absoluteBackup]);
  const entries = selectRestoreEntries(toc);
  if (entries.filter(line=>line.includes(' TABLE public ')).length !== 20) throw new Error('Unexpected catalogue/application schema; review the archive.');
  if (entries.filter(line=>line.includes(' TABLE DATA auth ')).length !== 2) throw new Error('Expected Auth users and identities data.');
  if (!entries.some(line=>line.includes(' TRIGGER auth users on_auth_user_created_customer_profile '))) throw new Error('Expected application Auth trigger missing.');
  fs.mkdirSync(resolvedOutput);
  const listFile = path.join(resolvedOutput,'selected.list');
  fs.writeFileSync(listFile,entries.join('\n')+'\n',{flag:'wx'});
  const sql = runTool(pgRestore,['--no-owner','--use-list',listFile,'--file=-',absoluteBackup]);
  const usersCopy = sql.indexOf('COPY auth.users (');
  const identitiesCopy = sql.indexOf('COPY auth.identities (');
  if (usersCopy < 0 || identitiesCopy < 0 || usersCopy > identitiesCopy) throw new Error('Auth parent/child COPY order is unsafe. Nothing restored.');
  const counts = copyCounts(sql);
  if (counts.length !== 21) throw new Error('Expected 19 application data tables plus two Auth data tables.');
  if (/\b(?:net\.http_(?:get|post)|cron\.schedule|supabase_functions\.http_request)\s*\(/i.test(sql)) throw new Error('Network/scheduler code requires manual review.');
  const sqlFile = path.join(resolvedOutput,'restore-test.sql');
  fs.writeFileSync(sqlFile,restoreSql(sql,counts,20,entries.filter(line=>line.includes(' POLICY public ')).length),{flag:'wx'});
  const manifest = {targetRef:TEST_REF,targetHost:TEST_HOST,backup: absoluteBackup,
    backupSHA256:createHash('sha256').update(fs.readFileSync(absoluteBackup)).digest('hex'),
    sqlFile,sqlSHA256:createHash('sha256').update(fs.readFileSync(sqlFile)).digest('hex'),entries:entries.length,counts,
    excluded:['all role definitions','managed schema definitions/configuration','Vault secrets','Storage metadata/objects','Auth sessions/refresh tokens/MFA/OAuth/SSO configuration','OTP challenge rows','migration ledger','publications/event triggers/cron configuration'],
    sanitised:['Test Auth passwords randomised and action/change tokens cleared; original backup unchanged'],
    status:'OFFLINE PREPARATION ONLY; no remote connection or restore performed'};
  fs.writeFileSync(path.join(resolvedOutput,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv[process.argv.indexOf(name)+1];
  for (const name of ['--backup','--pg-bin','--output']) if (!process.argv.includes(name)) throw new Error(`Missing ${name}`);
  const result = prepare({backup:arg('--backup'),pgBin:arg('--pg-bin'),output:arg('--output')});
  console.log(JSON.stringify({targetRef:result.targetRef,sqlFile:result.sqlFile,selectedEntries:result.entries,status:result.status},null,2));
}
