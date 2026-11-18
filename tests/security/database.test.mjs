import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";

// Real local PostgreSQL execution, with minimal Supabase Auth/Storage schemas.
// This does not connect to, or claim to verify, the deployed Supabase project.
test("database migration, ownership, MFA, and transactional guards", { timeout: 120000 }, async (t) => {
  const db = new PGlite({ extensions: { pgcrypto, citext } });
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}', email_confirmed_at timestamptz default now(), created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth, storage to anon, authenticated, service_role;
      grant execute on all functions in schema auth to anon, authenticated, service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text);
      alter table storage.objects enable row level security;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
      -- Match Supabase's direct default EXECUTE grants, not just PostgreSQL PUBLIC.
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    `);
    const migrations = (await fs.readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    for (const migration of migrations) {
      try { await db.exec(await fs.readFile(`supabase/migrations/${migration}`, "utf8")); }
      catch (error) { throw new Error(`Migration ${migration}: ${error.message}`); }
    }
    const ids = Array.from({ length: 5 }, (_, index) => `00000000-0000-4000-8000-00000000000${index + 1}`);
    const [alice, bob, admin, editor, fulfilment] = ids;
    for (let index = 0; index < ids.length; index += 1) await db.query("insert into auth.users(id,email) values($1,$2)", [ids[index], `security${index}@example.com`]);
    await db.exec("update public.customer_profiles set tuxar_verified=true,account_status='active'");
    await db.query("insert into public.admin_users(user_id,role) values($1,'admin'),($2,'editor'),($3,'fulfilment')", [admin, editor, fulfilment]);
    await db.exec("insert into public.products(slug,name,category,price_pence,status) values('security-test-product','Security test jacket','leather-jackets',39900,'active')");
    await db.exec("insert into public.product_variants(product_id,sku,size,color,stock) select id,'SECURITY-TEST-M','M','Black',100 from public.products where slug='security-test-product'");
    await db.exec("insert into public.coupons(code,discount_type,discount_value) values('SECURITY10','percentage',10)");
    const asRole = (role, user, aal, sql, params = []) => db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)", [JSON.stringify({ sub: user, aal, role: "authenticated" }), user || ""]);
      return tx.query(sql, params);
    });
    const customer = { customerName: "Security Test", customerPhone: "01234567890", streetAddress: "1 Test Street", city: "London", postalCode: "E1 1AA", country: "United Kingdom", shippingMethod: "STANDARD" };
    const items = [{ slug: "security-test-product", size: "M", color: "Black", qty: 1 }];
    const key = "10000000-0000-4000-8000-000000000001";
    // Owner-only local fixtures exercise retained historical transaction logic.
    // Application roles must remain unable to call the retired COD functions.
    const place = (user, requestKey, coupon = null, cart = items) => db.query("select public.place_cod_order_for_user($1::jsonb,$2::jsonb,$3,$4,$5) as result", [JSON.stringify(customer), JSON.stringify(cart), requestKey, user, coupon]);
    const first = (await place(alice, key)).rows[0].result;
    const second = (await place(bob, "10000000-0000-4000-8000-000000000002")).rows[0].result;
    await t.test("retired COD placement is denied to anon, authenticated and service_role", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        await assert.rejects(asRole(role, alice, "aal1", "select public.place_cod_order_for_user($1::jsonb,$2::jsonb,$3,$4,null)", [JSON.stringify(customer), JSON.stringify(items), key, alice]), /permission denied/);
      }
    });
    await t.test("staff RPCs reject anonymous execution despite Supabase default grants", async () => {
      for (const signature of ['is_admin_aal2(text[])','authorize_cancellation_email(uuid)','cancel_pending_cod_order(uuid,text)','mark_cod_collected(uuid)']) {
        const result = await db.query("select has_function_privilege('anon',$1,'EXECUTE') as anonymous, has_function_privilege('authenticated',$1,'EXECUTE') as staff", ['public.'+signature]);
        assert.equal(result.rows[0].anonymous,false,signature);
        assert.equal(result.rows[0].staff,true,signature);
      }
    });
    await t.test("anonymous users cannot read private orders or OTP tables", async () => {
      await assert.rejects(asRole("anon", null, "aal1", "select * from public.orders"), /permission denied/);
      await assert.rejects(asRole("anon", null, "aal1", "select * from public.customer_otp_challenges"), /permission denied/);
    });
    await t.test("customers can read only their own orders and items", async () => {
      const own = await asRole("authenticated", alice, "aal1", "select id from public.orders");
      assert.deepEqual(own.rows.map((row) => row.id), [first.id]);
      const other = await asRole("authenticated", alice, "aal1", "select * from public.order_items where order_id=$1", [second.id]);
      assert.equal(other.rows.length, 0);
    });
    await t.test("customers cannot mutate payments or promote themselves", async () => {
      await assert.rejects(asRole("authenticated", alice, "aal1", "update public.orders set payment_status='paid'"), /permission denied/);
      await assert.rejects(asRole("authenticated", alice, "aal1", "insert into public.admin_users(user_id,role) values($1,'owner')", [alice]), /row-level security/);
    });
    await t.test("verification, email, and status cannot be self-assigned", async () => {
      for (const sql of ["update public.customer_profiles set tuxar_verified=false", "update public.customer_profiles set account_status='active'", "update public.customer_profiles set email='attacker@example.com'"]) await assert.rejects(asRole("authenticated", alice, "aal1", sql), /permission denied/);
      const ordinary = await asRole("authenticated", alice, "aal1", "update public.customer_profiles set first_name='Allowed' where user_id=$1 returning first_name", [alice]);
      assert.equal(ordinary.rows[0].first_name, "Allowed");
    });
    await t.test("staff data requires MFA and the correct staff role", async () => {
      assert.equal((await asRole("authenticated", admin, "aal1", "select id from public.orders")).rows.length, 0);
      assert.equal((await asRole("authenticated", admin, "aal2", "select id from public.orders")).rows.length, 2);
      assert.equal((await asRole("authenticated", editor, "aal2", "select id from public.orders")).rows.length, 0);
      const blocked = await asRole("authenticated", fulfilment, "aal2", "update public.products set name='Unauthorized' returning id");
      assert.equal(blocked.rows.length, 0);
      const permitted = await asRole("authenticated", editor, "aal2", "update public.products set tagline='Editor update' where slug='security-test-product' returning id");
      assert.equal(permitted.rows.length, 1);
    });
    await t.test("order placement and private helpers cannot bypass the Edge Functions", async () => {
      await assert.rejects(asRole("authenticated", alice, "aal1", "select public.place_cod_order_internal($1::jsonb,$2::jsonb,$3)", [JSON.stringify(customer), JSON.stringify(items), key]), /permission denied/);
      await assert.rejects(asRole("authenticated", alice, "aal1", "select public.place_cod_order_for_user($1::jsonb,$2::jsonb,$3,$4,null)", [JSON.stringify(customer), JSON.stringify(items), key, alice]), /permission denied/);
      await assert.rejects(asRole("authenticated", alice, "aal1", "select public.consume_customer_otp($1,$2)", [alice, "a".repeat(64)]), /permission denied/);
    });
    await t.test("idempotency returns only the same customer's existing order", async () => {
      assert.equal((await place(alice, key)).rows[0].result.id, first.id);
      await assert.rejects(place(bob, key), /Invalid checkout request/);
    });
    await t.test("invalid coupons roll back COD order creation and stock changes", async () => {
      const before = (await db.query("select stock from public.product_variants where sku='SECURITY-TEST-M'")).rows[0].stock;
      await assert.rejects(place(alice, "10000000-0000-4000-8000-000000000003", "INVALID"), /Invalid coupon/);
      assert.equal((await db.query("select stock from public.product_variants where sku='SECURITY-TEST-M'")).rows[0].stock, before);
      assert.equal((await db.query("select id from public.orders where idempotency_key='10000000-0000-4000-8000-000000000003'")).rows.length, 0);
    });
    await t.test("valid COD coupon is calculated by the database", async () => {
      const placed = (await place(alice, "10000000-0000-4000-8000-000000000004", "SECURITY10")).rows[0].result;
      assert.equal(placed.totalPence, 35910); assert.equal(placed.discountPence, 3990);
    });
    await t.test("paid orders cannot be discounted later", async () => {
      await db.query("update public.orders set payment_status='paid' where id=$1", [first.id]);
      await assert.rejects(asRole("service_role", null, "aal1", "select public.redeem_order_coupon_for_user($1,'SECURITY10',$2)", [first.id, alice]), /cannot be discounted/);
    });
    await t.test("fulfilment is an authorized state transition, not a broad order update", async () => {
      await assert.rejects(asRole("authenticated", editor, "aal2", "select public.mark_order_fulfilled($1)", [first.id]), /permission required/);
      await assert.rejects(asRole("authenticated", fulfilment, "aal2", "select public.mark_order_fulfilled($1)", [first.id]), /Only dispatched/);
      await db.query("update public.orders set order_status='dispatched' where id=$1", [first.id]);
      await asRole("authenticated", fulfilment, "aal2", "select public.mark_order_fulfilled($1)", [first.id]);
      assert.equal((await db.query("select order_status from public.orders where id=$1", [first.id])).rows[0].order_status, "fulfilled");
    });
    await t.test("address records cannot be read, changed, or created for another customer", async () => {
      const address = (await asRole("authenticated", alice, "aal1", "insert into public.customer_addresses(user_id,first_name,last_name,phone,street_address,city,postal_code,country,address_type) values($1,'Test','Person','01234567890','1 Test Street','London','E1 1AA','GB','SHIPPING') returning id", [alice])).rows[0];
      assert.equal((await asRole("authenticated", bob, "aal1", "select * from public.customer_addresses")).rows.length, 0);
      assert.equal((await asRole("authenticated", bob, "aal1", "delete from public.customer_addresses where id=$1 returning id", [address.id])).rows.length, 0);
      await assert.rejects(asRole("authenticated", bob, "aal1", "update public.customer_addresses set user_id=$1 where id=$2", [bob, address.id]).then((result) => { if (result.affectedRows === 0) throw new Error("No accessible rows"); }), /No accessible rows|row-level security/);
      await assert.rejects(asRole("authenticated", bob, "aal1", "insert into public.customer_addresses(user_id,first_name,last_name,phone,street_address,city,postal_code,country,address_type) values($1,'Test','Person','01234567890','1 Test Street','London','E1 1AA','GB','SHIPPING')", [alice]), /row-level security/);
    });
    await t.test("refund reservation requires admin MFA and excludes concurrent dispatch", async () => {
      await db.query("update public.orders set payment_method='stripe',payment_status='paid',stripe_payment_intent_id='pi_LocalTest',order_status='pending' where id=$1", [second.id]);
      for (const [actor, aal] of [[alice,"aal2"],[editor,"aal2"],[fulfilment,"aal2"],[admin,"aal1"]]) {
        await assert.rejects(asRole("authenticated", actor, aal, "select public.prepare_stripe_cancellation($1)", [second.id]), /Refund permission/);
      }
      await asRole("authenticated", admin, "aal2", "select public.prepare_stripe_cancellation($1)", [second.id]);
      await asRole("authenticated", admin, "aal2", "select public.prepare_stripe_cancellation($1)", [second.id]);
      const dispatched = await asRole("service_role", null, "aal1", "update public.orders set order_status='dispatched' where id=$1 and order_status='pending' and refund_status is null and stripe_refund_id is null returning id", [second.id]);
      assert.equal(dispatched.rows.length, 0);
      await db.query("update public.orders set refund_status=null,order_status='dispatched' where id=$1", [second.id]);
      await assert.rejects(asRole("authenticated", admin, "aal2", "select public.prepare_stripe_cancellation($1)", [second.id]), /Only pending/);
    });
    await t.test("rate limiter rejects excess requests and is service-only", async () => {
      const bucket = "f".repeat(64);
      const outcomes = [];
      for (let i = 0; i < 5; i += 1) outcomes.push((await asRole("service_role", null, "aal1", "select public.consume_security_rate_limit($1,3,60) as allowed", [bucket])).rows[0].allowed);
      assert.deepEqual(outcomes, [true, true, true, false, false]);
      await assert.rejects(asRole("authenticated", alice, "aal1", "select public.consume_security_rate_limit($1,3,60)", [bucket]), /permission denied/);
    });
    await t.test("OTP attempts are capped at five", async () => {
      await db.query("insert into public.customer_otp_challenges(user_id,code_hash,expires_at) values($1,$2,now()+interval '10 minutes')", [alice, "a".repeat(64)]);
      for (let i = 0; i < 5; i += 1) assert.equal((await asRole("service_role", null, "aal1", "select public.consume_customer_otp($1,$2) as ok", [alice, "b".repeat(64)])).rows[0].ok, false);
      assert.equal((await asRole("service_role", null, "aal1", "select public.consume_customer_otp($1,$2) as ok", [alice, "a".repeat(64)])).rows[0].ok, false);
    });
    await t.test("a used newest OTP never re-enables an older code", async () => {
      await db.query("insert into public.customer_otp_challenges(user_id,code_hash,expires_at,created_at) values($1,$2,now()+interval '10 minutes',now()-interval '1 minute'),($1,$3,now()+interval '10 minutes',now())", [bob, "c".repeat(64), "d".repeat(64)]);
      const consume = async (hash) => (await asRole("service_role", null, "aal1", "select public.consume_customer_otp($1,$2) as ok", [bob, hash])).rows[0].ok;
      assert.equal(await consume("d".repeat(64)), true);
      assert.equal(await consume("d".repeat(64)), false);
      assert.equal(await consume("c".repeat(64)), false);
    });
    await t.test("disabled accounts cannot activate themselves", async () => {
      await db.query("update public.customer_profiles set account_status='disabled' where user_id=$1", [bob]);
      assert.equal((await asRole("authenticated", bob, "aal1", "select public.activate_email_customer_profile() as ok")).rows[0].ok, false);
    });
    await t.test("disabled accounts lose ownership-based access and disabled staff cannot use old MFA tokens", async () => {
      assert.equal((await asRole("authenticated", bob, "aal1", "select id from public.orders")).rows.length, 0);
      await db.query("update public.customer_profiles set account_status='disabled' where user_id=$1", [alice]);
      assert.equal((await asRole("authenticated", alice, "aal1", "select id from public.customer_addresses")).rows.length, 0);
      await db.query("update public.customer_profiles set account_status='disabled' where user_id=$1", [admin]);
      assert.equal((await asRole("authenticated", admin, "aal2", "select id from public.orders")).rows.length, 0);
    });
    await t.test("anonymous shoppers can only see active variants of active products", async () => {
      assert.equal((await asRole("anon", null, "aal1", "select sku from public.product_variants where sku='SECURITY-TEST-M'")).rows.length, 1);
      await db.exec("update public.product_variants set active=false where sku='SECURITY-TEST-M'");
      assert.equal((await asRole("anon", null, "aal1", "select sku from public.product_variants where sku='SECURITY-TEST-M'")).rows.length, 0);
      await db.exec("update public.product_variants set active=true where sku='SECURITY-TEST-M'; update public.products set status='draft' where slug='security-test-product'");
      assert.equal((await asRole("anon", null, "aal1", "select sku from public.product_variants where sku='SECURITY-TEST-M'")).rows.length, 0);
    });
    await t.test("operator metadata verification SQL executes read-only without customer row bodies", async () => {
      await db.exec(await fs.readFile("supabase/verification/security-metadata.sql", "utf8"));
    });
    await t.test("approved catalogue import preserves existing records and refuses stock-resetting reruns", async () => {
      const before = (await db.query("select count(*)::integer as count from public.products")).rows[0].count;
      // Reconstruct the historical insert-only fixture from public source data.
      // Never depend on private/generated operator output in a clean checkout.
      const products = JSON.parse(await fs.readFile("src/data/products/approved-catalogue.json", "utf8")).products;
      const variants = JSON.parse(await fs.readFile("src/data/products/local-jackets.json", "utf8")).variants;
      const sql = (await fs.readFile("tests/fixtures/catalogue-sql/import-approved-catalogue.sql", "utf8"))
        .replace('__CATALOGUE_PAYLOAD__', JSON.stringify({ products, variants }))
        .replace('__CATALOGUE_SLUGS__', JSON.stringify(products.map(p => ({ slug: p.slug }))));
      await db.exec(sql);
      assert.equal((await db.query("select count(*)::integer as count from public.products")).rows[0].count, before + 125);
      const imported = JSON.parse(await fs.readFile("src/data/products/approved-catalogue.json", "utf8")).products;
      const slugs = imported.map(p => p.slug);
      assert.equal((await db.query("select count(*)::integer as count from public.product_variants v join public.products p on p.id=v.product_id where p.slug=any($1) and v.stock=10", [slugs])).rows[0].count, 500);
      assert.equal((await db.query("select count(*)::integer as count from public.product_images i join public.products p on p.id=i.product_id where p.slug=any($1)", [slugs])).rows[0].count, 602);
      await db.query("update public.product_variants set stock=7 where sku=$1", ["TX-SC-TAN-M"]);
      await assert.rejects(db.exec(sql), /Product slug already exists/);
      await db.exec("rollback");
      assert.equal((await db.query("select stock from public.product_variants where sku=$1", ["TX-SC-TAN-M"])).rows[0].stock, 7);
    });
  } finally { await db.close(); }
});
