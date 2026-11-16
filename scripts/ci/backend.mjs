import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This is deliberately a history check, not an automatic migration repair.
// Existing SQL-editor installations must reconcile history once before enabling CD.
export function migrationPreflightSql(versions) {
  if(versions.some(value=>!/^\d{12,14}$/.test(value))) throw new Error('Invalid migration version');
  const baseline=versions.filter(value=>value<='202610310001');
  return `do $check$ begin
if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Migration history is missing. Reconcile the existing production schema before enabling CI/CD.'; end if;
if exists(select version from unnest(array[${baseline.map(v=>`'${v}'`).join(',')}]::text[]) as expected(version) except select version from supabase_migrations.schema_migrations) then raise exception 'Production migration baseline is incomplete. Verify the schema and reconcile history; do not rerun old seed/import migrations.'; end if;
if exists(select version from supabase_migrations.schema_migrations where version not in (${versions.map(v=>`'${v}'`).join(',')})) then raise exception 'Production has migrations missing from this checkout. Restore them before deploying.'; end if;
end $check$;`;
}

export function validateBackendEnvironment(env) {
  for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_URL','SUPABASE_PROJECT_REF','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']) if(!env[key]) throw new Error(`Set ${key} in the production GitHub environment`);
  if(!['true','false'].includes(env.VITE_STRIPE_ENABLED)) throw new Error('Set VITE_STRIPE_ENABLED explicitly to match the approved live payment configuration');
  const ref=env.SUPABASE_PROJECT_REF;
  if(!/^[a-z]{20}$/.test(ref) || env.VITE_SUPABASE_URL!==`https://${ref}.supabase.co`) throw new Error('Supabase project reference and public URL do not match');
  const url=new URL(env.SUPABASE_DB_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol) || !url.password || !(url.hostname===`db.${ref}.supabase.co` || (url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username)===`postgres.${ref}`))) throw new Error('Use the matching Supabase direct/session-pooler database connection URL');
  return {database:url,ref};
}

const serverSecretNames=['RESEND_API_KEY','AUTH_FROM_EMAIL','ORDERS_FROM_EMAIL','MARKETING_FROM_EMAIL','CONTACT_FROM_EMAIL','CONTACT_NOTIFICATION_EMAIL','OTP_PEPPER','RATE_LIMIT_SECRET','SITE_URL','ADDITIONAL_ALLOWED_ORIGINS','ALLOW_LOCAL_ORIGINS','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'];
export function functionSecretsFile(input) {
  const values=JSON.parse(input);
  if(!values || typeof values!=='object' || Array.isArray(values)) throw new Error('Function secrets must be a JSON object');
  return Object.entries(values).map(([key,value])=>{
    if(!serverSecretNames.includes(key) || typeof value!=='string' || !value || /[\r\n\0]/.test(value)) throw new Error('Function secrets contain an unsupported name or multiline/empty value');
    return `${key}=${JSON.stringify(value)}`;
  }).join('\n')+'\n';
}

async function main() {
  const config=validateBackendEnvironment(process.env);
  const secretContent=process.env.SUPABASE_FUNCTION_SECRETS ? functionSecretsFile(process.env.SUPABASE_FUNCTION_SECRETS) : null;
  const versions=(await fs.readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).map(name=>name.split('_')[0]).sort();
  const extraMasks=[decodeURIComponent(config.database.password)];
  if(process.env.SUPABASE_FUNCTION_SECRETS) extraMasks.push(...Object.values(JSON.parse(process.env.SUPABASE_FUNCTION_SECRETS)));
  const masks=[...Object.entries(process.env).filter(([key])=>/TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DB_URL/.test(key)).map(([,v])=>v),...extraMasks].filter(v=>typeof v==='string' && v.length>3);
  const redact=text=>masks.reduce((result,value)=>result.replaceAll(value,'[redacted]'),String(text??''));
  const run=(label,command,args,options={})=>{
    console.log(label);
    try { const result=execFileSync(command,args,{encoding:'utf8',maxBuffer:16000000,env:process.env,...options});if(result) console.log(redact(result)); }
    catch(error) { if(error.stdout)console.error(redact(error.stdout));if(error.stderr)console.error(redact(error.stderr));throw new Error(`${label} failed; publication stopped`); }
  };
  const pgEnv={...process.env,PGDATABASE:process.env.SUPABASE_DB_URL,PGSSLMODE:'require',PGCONNECT_TIMEOUT:'15'};
  run('Checking existing database migration history','psql',['-X','--set','ON_ERROR_STOP=1','--quiet'],{input:migrationPreflightSql(versions),env:pgEnv});
  if(process.argv.includes('--check')) return;
  const npx=process.platform==='win32'?'npx.cmd':'npx';
  const supabase=['--yes','supabase@2.121.0'];
  run('Applying pending schema migrations',npx,[...supabase,'db','push','--db-url',process.env.SUPABASE_DB_URL,'--yes']);
  if(process.env.SUPABASE_FUNCTION_SECRETS) {
    const folder=await fs.mkdtemp(path.join(process.env.RUNNER_TEMP??'output/ci','function-secrets-'));
    const file=path.join(folder,'secrets.env');
    try {
      await fs.writeFile(file,secretContent,{mode:0o600});
      run('Updating explicitly supplied server secrets',npx,[...supabase,'secrets','set','--project-ref',config.ref,'--env-file',file]);
    } finally { await fs.rm(file,{force:true});await fs.rmdir(folder); }
  }
  run('Deploying Edge Functions',npx,[...supabase,'functions','deploy','--project-ref',config.ref,'--use-api']);
  run('Applying new catalogue releases once','psql',['-X','--set','ON_ERROR_STOP=1','--quiet','--file','output/ci/catalogue.sql'],{env:pgEnv});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
