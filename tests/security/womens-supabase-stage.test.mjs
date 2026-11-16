import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Generate local SQL artifacts, then execute only against an in-memory database.
await import('../../scripts/prepare-womens-supabase.mjs');
const folder = 'output/supabase-womens-release';
const stage = await fs.readFile(`${folder}/02-STAGE-94-WOMENS-PRODUCTS.sql`, 'utf8');
const repair = await fs.readFile(`${folder}/03-REPAIR-MENS-FRONT-PHOTO.sql`, 'utf8');
const plan = JSON.parse(await fs.readFile(`${folder}/review-plan.json`, 'utf8'));

test('staging inserts 94 drafts with 752 variants at 15 units and preserves existing men stock/prices', async context => {
  const db = new PGlite();
  context.after(() => db.close());
  const schema = (await fs.readFile('supabase/migrations/202609130003_catalog_content.sql', 'utf8')).split('create table if not exists public.blog_posts')[0];
  await db.exec(schema);
  await db.exec(`create table public.product_categories(slug text primary key,status text);
    insert into public.product_categories values('leather-jackets','active');
    insert into public.products(slug,name,category,price_pence,status) values('classic-zip-quilted','Existing men jacket','classic',20000,'active');
    insert into public.product_variants(product_id,sku,size,color,stock) select id,'EXISTING-MEN-M','M','Black',7 from public.products;
    insert into public.product_images(product_id,url,position) select id,'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994664/tuxar/website/product/classic-zip-new.webp',0 from public.products;
    insert into public.product_images(product_id,url,position) select id,'https://example.com/existing-back.webp',1 from public.products;`);
  await db.exec(stage);
  const counts = (await db.query(`select count(distinct p.id)::int products,count(v.id)::int variants,sum(v.stock)::int stock from public.products p join public.product_variants v on v.product_id=p.id where p.status='draft'`)).rows[0];
  assert.deepEqual(counts, { products: 94, variants: 752, stock: 11280 });
  assert.equal((await db.query(`select count(*)::int count from public.product_variants v join public.products p on p.id=v.product_id where p.status='draft' and (v.stock<>15 or v.size not in ('S','M','L','XL','2XL','3XL','4XL','5XL'))`)).rows[0].count, 0);
  await assert.rejects(() => db.exec(stage), /slug already exists/);
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int count from public.products')).rows[0].count, 95);
  await db.exec(repair);
  await db.exec(repair); // Idempotent photo repair; never inserts another product.
  const existing = (await db.query(`select p.price_pence,p.status,v.stock,v.sku from public.products p join public.product_variants v on v.product_id=p.id where p.slug='classic-zip-quilted'`)).rows[0];
  assert.deepEqual(existing, { price_pence: 20000, status: 'active', stock: 7, sku: 'EXISTING-MEN-M' });
  const photos = (await db.query(`select i.url,i.position from public.product_images i join public.products p on p.id=i.product_id where p.slug='classic-zip-quilted' order by i.position`)).rows;
  assert.deepEqual(photos, [{ url: 'https://res.cloudinary.com/rllwk4bi/image/upload/v1793051072/classic-zip-new.webp', position: 0 }, { url: 'https://example.com/existing-back.webp', position: 1 }]);
  await db.exec(`update public.product_images set url='https://example.com/unknown-front.webp' where position=0 and product_id=(select id from public.products where slug='classic-zip-quilted')`);
  await assert.rejects(() => db.exec(repair), /exactly one known front photo/);
  await db.exec('rollback');
  assert.equal((await db.query(`select url from public.product_images where position=0 and product_id=(select id from public.products where slug='classic-zip-quilted')`)).rows[0].url, 'https://example.com/unknown-front.webp');
});

test('release plan has confirmed size/stock allocations and every product photo is on Cloudinary', () => {
  assert.equal(plan.stageStatus, 'draft');
  assert.equal(plan.totalUnits, 11280);
  assert.equal(plan.products.length, 94);
  assert.equal(plan.variants.length, 752);
  for (const product of plan.products) {
    assert.equal(product.audience, 'women');
    assert.deepEqual(product.sizes, ['S','M','L','XL','2XL','3XL','4XL','5XL']);
    assert.ok(product.gallery.every(url => url.startsWith('https://res.cloudinary.com/rllwk4bi/image/upload/')));
  }
});
