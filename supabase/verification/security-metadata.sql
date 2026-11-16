-- METADATA ONLY. Run in the SQL Editor of the owner-confirmed Tuxar Production
-- project ncgxljatjajgcvnlrncm. No customer row bodies or credential values.
-- This file is NOT a migration and is NOT evidence until the owner runs/reviews it.
begin transaction read only;
set local statement_timeout = '15s';

select current_database() as database_name, current_user as connected_role,
  to_regclass('supabase_migrations.schema_migrations') as ledger_table;

-- If ledger_table is present, run READ_ONLY_MIGRATION_LEDGER.sql separately.
with expected(name) as (values
  ('admin_users'),('orders'),('order_items'),('admin_audit_log'),('products'),
  ('product_variants'),('product_images'),('product_collections'),('product_categories'),
  ('blog_posts'),('customer_profiles'),('customer_otp_challenges'),('inventory_movements'),
  ('coupons'),('marketing_templates'),('marketing_campaigns'),('media_assets'),
  ('contact_messages'),('newsletter_subscribers'),('admin_reporting_period'),
  ('customer_addresses'),('security_rate_limits'))
select expected.name, c.oid is not null as exists,
  c.relrowsecurity as rls_enabled, pg_get_userbyid(c.relowner) as owner
from expected left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=expected.name
order by expected.name;

select c.relname as table_name,a.attname as column_name,
  format_type(a.atttypid,a.atttypmod) as data_type,a.attnotnull
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid
where n.nspname='public' and a.attnum>0 and not a.attisdropped
  and c.relname in ('orders','order_items','customer_profiles','product_variants','coupons','media_assets')
order by c.relname,a.attnum;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;

select role_name,c.relname as table_name,
  has_table_privilege(role_name,c.oid,'SELECT') as can_select,
  has_table_privilege(role_name,c.oid,'INSERT') as can_insert,
  has_table_privilege(role_name,c.oid,'UPDATE') as can_update,
  has_table_privilege(role_name,c.oid,'DELETE') as can_delete
from (values ('anon'),('authenticated'),('service_role')) roles(role_name)
cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname,role_name;

select a.attname as protected_profile_column,
  has_column_privilege('authenticated',c.oid,a.attname,'UPDATE') as customer_can_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid
where n.nspname='public' and c.relname='customer_profiles'
  and a.attname in ('user_id','email','tuxar_verified','verified_at','account_status','registration_method');

select p.oid::regprocedure::text as function_signature,p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
  md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' order by p.proname;

select role_name,has_schema_privilege(role_name,'public','CREATE') as public_schema_create
from (values ('anon'),('authenticated')) roles(role_name);

select tablename,indexname,indexdef from pg_indexes where schemaname='public'
order by tablename,indexname;
select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition,convalidated
from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname;

-- Returns only counts, not names or customer data. Duplicate variants can make
-- authoritative price/stock lookup ambiguous; do not auto-delete or merge them.
select count(*) as duplicate_variant_selection_groups from (
  select product_id,size,color from public.product_variants
  group by product_id,size,color having count(*)>1
) duplicates;

-- Only boolean policy requirements / signatures, not raw function definitions.
select to_regprocedure('public.place_cod_order(jsonb,jsonb,text)') as legacy_cod,
  to_regprocedure('public.place_cod_order_internal(jsonb,jsonb,text)') as private_cod,
  to_regprocedure('public.place_cod_order_for_user(jsonb,jsonb,text,uuid,text)') as protected_cod,
  to_regprocedure('public.consume_security_rate_limit(text,integer,integer)') as limiter,
  to_regprocedure('public.consume_customer_otp(uuid,text)') as otp_consumer,
  to_regprocedure('public.prepare_stripe_cancellation(uuid)') as refund_reservation;
select position('aal2' in pg_get_functiondef(p.oid))>0 as admin_function_mentions_mfa,
  position('disabled' in pg_get_functiondef(p.oid))>0 as admin_function_checks_disabled
from pg_proc p where p.oid=to_regprocedure('public.is_admin(text[])');

commit;
