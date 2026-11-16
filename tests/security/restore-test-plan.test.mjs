import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {selectRestoreEntries,copyCounts,restoreSql,TEST_REF,TEST_HOST} from '../../scripts/prepare-restore-test.mjs';

test('restore selection permits application objects and minimal Auth data, excluding managed secrets and sessions',()=>{
  const allowed=['1; 1259 1 TABLE public orders postgres','2; 0 1 TABLE DATA public orders postgres','3; 0 2 TABLE DATA auth users supabase_auth_admin','4; 0 3 TABLE DATA auth identities supabase_auth_admin','5; 2620 4 TRIGGER auth users on_auth_user_created_customer_profile supabase_auth_admin','6; 0 0 ACL public TABLE orders postgres','7; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres'];
  const denied=['8; 0 4 TABLE DATA auth sessions supabase_auth_admin','9; 0 5 TABLE DATA vault secrets supabase_admin','10; 0 6 TABLE DATA auth refresh_tokens supabase_auth_admin','11; 0 7 TABLE DATA public customer_otp_challenges postgres','12; 0 0 ACL public FUNCTION citextin(cstring) supabase_admin','13; 0 1 TABLE DATA storage objects supabase_storage_admin','14; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin','15; 0 0 EVENT TRIGGER - issue_pg_net_access supabase_admin','16; 0 0 TABLE DATA supabase_migrations schema_migrations postgres','17; 0 0 PUBLICATION - supabase_realtime postgres'];
  assert.deepEqual(selectRestoreEntries([...allowed,...denied].join('\n')),allowed);
});

test('COPY verification counts rows without including private contents in its summary',()=>{
  const sql='COPY public.products (id, description) FROM stdin;\na\tFirst\\nline\nb\tSecond\n\\.\nCOPY auth.users (id) FROM stdin;\n\\.\n';
  assert.deepEqual(copyCounts(sql),[{schema:'public',table:'products',count:2},{schema:'auth',table:'users',count:0}]);
  assert.throws(()=>copyCounts('COPY public.products (id) FROM stdin;\na\n'),/Incomplete/);
});

test('Auth users load before identities even when the archive has the opposite order; FK remains enforced',async()=>{
  const users='3; 0 2 TABLE DATA auth users supabase_auth_admin';
  const identities='4; 0 3 TABLE DATA auth identities supabase_auth_admin';
  const table='1; 1259 1 TABLE public orders postgres';
  const policy='8; 3256 1 POLICY public orders own orders postgres';
  assert.deepEqual(selectRestoreEntries([table,identities,users,policy].join('\n')),[table,users,identities,policy]);
  const db=new PGlite();
  try {
    await db.exec('create schema auth; create table auth.users(id integer primary key); create table auth.identities(id integer primary key,user_id integer references auth.users(id));');
    // Reproduce the reported failure against a real local Postgres engine.
    await assert.rejects(db.exec('begin; insert into auth.identities values(1,1);'),/foreign key/);
    await db.exec('rollback;');
    const empty=await db.query('select (select count(*) from auth.users)::int as users,(select count(*) from auth.identities)::int as identities');
    assert.deepEqual(empty.rows,[{users:0,identities:0}]);
    await db.exec('begin;');
    for(const entry of selectRestoreEntries([identities,users].join('\n'))) {
      await db.exec(entry===users?'insert into auth.users values(1)':'insert into auth.identities values(1,1)');
    }
    await db.exec('commit;');
    const restored=await db.query('select count(*)::int as count from auth.identities i join auth.users u on u.id=i.user_id');
    assert.equal(restored.rows[0].count,1);
    await assert.rejects(db.exec('insert into auth.identities values(2,99)'),/foreign key/);
  } finally {await db.close();}
});

test('restore SQL refuses occupied targets and keeps restore plus checks in one transaction',()=>{
  const sql=restoreSql('-- fixture\n',[{schema:'public',table:'products',count:2}],20,40);
  assert.match(sql,/\\set ON_ERROR_STOP on/);
  assert.ok(sql.indexOf('begin;')<sql.indexOf('-- fixture'));
  assert.ok(sql.indexOf('$tuxar_verify$;')<sql.indexOf('commit;'));
  assert.match(sql,/Target is not empty/);
  assert.match(sql,/Unexpected existing Auth trigger/);
  assert.match(sql,/Count mismatch: public.products/);
  assert.match(sql,/update auth.users set encrypted_password = extensions.crypt/);
  assert.match(sql,/confirmation_token.*recovery_token.*reauthentication_token/);
  assert.doesNotMatch(sql,/truncate|drop table|disable trigger|session_replication_role\s*=/i);
  assert.throws(()=>restoreSql('\\connect production',[],0,0),/database switch/);
  assert.equal(TEST_REF,'kiwpvindkuponqwgmneq');
  assert.equal(TEST_HOST,'aws-0-eu-west-1.pooler.supabase.com');
});

test('runner pins the confirmed test target, prompts locally and refuses preparation/hash failures',async()=>{
  const runner=await fs.readFile('scripts/restore-tuxar-test.ps1','utf8');
  assert.match(runner,/\$testRef = 'kiwpvindkuponqwgmneq'/);
  assert.match(runner,/\$testHost = 'aws-0-eu-west-1\.pooler\.supabase\.com'/);
  assert.match(runner,/\$testUser = 'postgres\.kiwpvindkuponqwgmneq'/);
  const parameters=runner.slice(0,runner.indexOf("$ErrorActionPreference"));
  assert.doesNotMatch(parameters,/host|user|connection|password/i);
  assert.match(runner,/Read-Host/);
  assert.match(runner,/\$confirmation -cne \$testRef/);
  assert.match(runner,/Get-FileHash/);
  assert.match(runner,/-X -W -v ON_ERROR_STOP=1/);
  assert.match(runner,/if \(\$LASTEXITCODE -ne 0\)/);
  assert.doesNotMatch(runner,/PGPASSWORD|supabase db push|--clean|DROP TABLE/i);
});
