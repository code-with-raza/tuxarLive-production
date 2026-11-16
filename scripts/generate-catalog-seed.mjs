import { createServer } from "vite";
import { writeFile } from "node:fs/promises";

const q = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

try {
  const { PRODUCTS } = await server.ssrLoadModule("/src/data/products.ts");
  const { getAllPosts } = await server.ssrLoadModule("/src/lib/blog/index.ts");
  const posts = getAllPosts();
  const sql = ["begin;"];

  for (const product of PRODUCTS) {
    sql.push(`insert into public.products (slug,name,tagline,description,category,price_pence,compare_price_pence,material,weight,origin,badge,seo_title,seo_description,status)
values (${q(product.slug)},${q(product.name)},${q(product.tagline)},${q(product.description)},${q(product.category)},${Math.round(product.priceGBP * 100)},${product.comparePriceGBP ? Math.round(product.comparePriceGBP * 100) : "null"},${q(product.material)},${q(product.weight)},${q(product.origin)},${q(product.badge)},${q(product.name)},${q(product.description.slice(0, 160))},'active')
on conflict (slug) do update set name=excluded.name,tagline=excluded.tagline,description=excluded.description,category=excluded.category,price_pence=excluded.price_pence,material=excluded.material,weight=excluded.weight,origin=excluded.origin,badge=excluded.badge,status='active',updated_at=now();`);
    sql.push(`delete from public.product_variants where product_id=(select id from public.products where slug=${q(product.slug)});`);
    for (const color of product.colors) for (const size of product.sizes) {
      const sku = `${product.slug}-${color.name}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 80);
      sql.push(`insert into public.product_variants(product_id,sku,size,color,color_hex,stock) values ((select id from public.products where slug=${q(product.slug)}),${q(sku)},${q(size)},${q(color.name)},${q(color.hex)},10);`);
    }
    sql.push(`delete from public.product_images where product_id=(select id from public.products where slug=${q(product.slug)});`);
    [...new Set(product.gallery?.length ? product.gallery : [product.image])].forEach((url, position) => sql.push(`insert into public.product_images(product_id,url,alt_text,position) values ((select id from public.products where slug=${q(product.slug)}),${q(url)},${q(product.name)},${position});`));
    sql.push(`delete from public.product_collections where product_id=(select id from public.products where slug=${q(product.slug)});`);
    for (const collection of product.collections ?? []) sql.push(`insert into public.product_collections(product_id,collection_slug) values ((select id from public.products where slug=${q(product.slug)}),${q(collection)});`);
  }

  for (const post of posts) {
    const locale = post.slug.startsWith("come-") || post.slug.startsWith("guida-") ? "it" : post.slug.startsWith("comment-") || post.slug.startsWith("guide-") ? "fr" : post.slug.startsWith("como-") || post.slug.startsWith("guia-") ? "es" : post.slug.startsWith("wie-") || post.slug.startsWith("leitfaden-") ? "de" : "en";
    sql.push(`insert into public.blog_posts(locale,slug,title,excerpt,content_markdown,category,author,cover_image_url,cover_image_alt,seo_title,seo_description,status,published_at)
values (${q(locale)},${q(post.slug)},${q(post.title)},${q(post.excerpt)},${q(post.contentMarkdown)},${q(post.category)},${q(post.author)},${q(post.image)},${q(post.seo?.imageAlt || post.title)},${q(post.seo?.metaTitle || post.title)},${q(post.seo?.metaDescription || post.excerpt)},'published',${q(post.date ? new Date(post.date).toISOString() : new Date().toISOString())})
on conflict (locale,slug) do update set title=excluded.title,excerpt=excluded.excerpt,content_markdown=excluded.content_markdown,category=excluded.category,author=excluded.author,cover_image_url=excluded.cover_image_url,cover_image_alt=excluded.cover_image_alt,seo_title=excluded.seo_title,seo_description=excluded.seo_description,status='published',published_at=excluded.published_at,updated_at=now();`);
  }
  sql.push("commit;", "select (select count(*) from public.products) as products, (select count(*) from public.product_variants) as variants, (select count(*) from public.blog_posts) as blog_posts;");
  const seed = sql.join("\n\n");
  await writeFile("supabase/seed_catalog.sql", seed);
  console.log(`Generated ${PRODUCTS.length} products and ${posts.length} articles.`);
} finally {
  await server.close();
}
