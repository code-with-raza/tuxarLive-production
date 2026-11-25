import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('legacy gallery repair changes only the three products image URLs and preserves staff uploads and commerce data',async()=>{
 const db=new PGlite();
 const files={
  'aviator-g1-flight-jacket':['flight_jacket/flight_jacket.webp','flight_jacket/flight_jacket1.webp','flight_jacket/flight_jacket2.webp','flight_jacket/flight_jacket3.webp'],
  'rider-gloves-carbon-noir':['glove/Carbon_Knuckle_front.webp','glove/Carbon_Knuckle_back.webp','glove/Carbon_Knuckle_side.webp'],
  'rider-gloves-carbon-white':['glove/Carbon_Knuckle_white_front.webp','glove/Carbon_Knuckle_white_back.webp','glove/Carbon_Knuckle_white_side.webp'],
 };
 try {
  await db.exec('create table products(id integer primary key,slug text,price_pence integer,status text);create table product_images(id serial primary key,product_id integer,url text,position integer);create table product_variants(product_id integer,stock integer);create table orders(id integer,total_pence integer);insert into orders values(1,15000)');
  const manifest=JSON.parse(await fs.readFile('src/data/cloudinary-assets.json','utf8'));
  let id=0;const expected=[];
  for(const [slug,images] of Object.entries(files)){
   id++;await db.query('insert into products values($1,$2,$3,$4)',[id,slug,id===1?15000:5000,'active']);
   await db.query('insert into product_variants values($1,17)',[id]);
   for(const [position,file] of images.entries()){
    const source='/src/assets/products/'+file;
    await db.query('insert into product_images(product_id,url,position) values($1,$2,$3)',[id,source,position]);
    expected.push({product_id:id,url:manifest[source].url,position});
   }
  }
  const staffUrl='https://res.cloudinary.com/example/image/upload/staff-new-image.webp';
  await db.query('insert into product_images(product_id,url,position) values(1,$1,99)',[staffUrl]);
  expected.splice(4,0,{product_id:1,url:staffUrl,position:99});
  await db.exec("insert into products values(4,'unrelated',12345,'draft');insert into product_images(product_id,url,position) values(4,'/src/assets/products/glove/Carbon_Knuckle_front.webp',0)");
  expected.push({product_id:4,url:'/src/assets/products/glove/Carbon_Knuckle_front.webp',position:0});
  const before=(await db.query('select * from products order by id')).rows;
  const sql=await fs.readFile('supabase/migrations/202611260001_repair_legacy_product_images.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select product_id,url,position from product_images order by product_id,position')).rows,expected);
  assert.deepEqual((await db.query('select * from products order by id')).rows,before);
  assert.deepEqual((await db.query('select stock from product_variants')).rows,[{stock:17},{stock:17},{stock:17}]);
  assert.deepEqual((await db.query('select * from orders')).rows,[{id:1,total_pence:15000}]);
 } finally {await db.close()}
});
