import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { evaluate, hosting } from '../helpers/wordpress-rewrite-model.mjs';
const fixture = JSON.parse(await fs.readFile('tests/fixtures/legacy-wordpress-404.json', 'utf8'));

test('the earlier 35-URL export now returns 410 except its exact current shop replacement', () => {
  for (const path of fixture.paths) assert.equal(evaluate(path)?.status, path === '/shop/' ? 301 : 410, path);
});

test('WordPress query guards are bounded by key and old entry point, including malformed identities', () => {
  for (const target of ['/?product=unmapped', '/?page_id=27770', '/?p=123', '/?paged=3&post_type=product', '/?ND', '/?SA', '/?MD', '/?page_id=12?add-to-cart%3D2243', '/?utm_source=x&ND&other=1', '/?add-to-cart=999', '/checkout/?add-to-cart=2689', '/shop/?add-to-cart=1', '/index.php?post_type=product']) assert.equal(evaluate(target)?.status, 410, target);
  for (const target of ['/', '/?utm_source=google', '/?utm_campaign=ND', '/?utm_source=x%26page_id%3D12', '/?ND_extra', '/?SAMPLE', '/?not_page_id=2777', '/?not_product=test', '/?attribute_pa_size=l', '/en/?page_id=2777', '/en/shop?product=old', '/en/shop?q=leather&page=2&sort=price', '/en/checkout?session_id=cs_example', '/en/checkout?add-to-cart=2689', '/en/login?returnTo=%2Fen%2Fcheckout', '/en/confirmation?orderNumber=cs_public_example', '/en/account?code=oauth_example', '/checkout/', '/en/wishlist', '/fr/product/classic-button-trucker', '/robots.txt', '/sitemap.xml', '/assets/index-example.js', '/consent-default.js']) assert.equal(evaluate(target), undefined, target);
});

test('retired namespace guards do not match similar names or current localized routes', () => {
  for (const path of ['/product/unmapped-new-old-slug', '/product-category/unmapped', '/product-tag/example', '/tag/example', '/category/example']) assert.equal(evaluate(path)?.status, 410);
  for (const path of ['/products/example', '/productivity', '/tagged/example', '/category-new', '/en/product/classic-button-trucker', '/en/collections/bomber-jackets']) assert.equal(evaluate(path), undefined);
});

test('WordPress admin is disallowed in robots and forbidden before all redirects', async () => {
  const robots = await fs.readFile('public/robots.txt', 'utf8');
  assert.match(robots, /^Disallow: \/wp-admin\/$/m);
  assert.ok(hosting.indexOf('RewriteRule ^wp-admin') < hosting.indexOf('# Current women'));
  for (const url of ['/wp-admin', '/wp-admin/', '/wp-admin/admin.php', '/WP-ADMIN/?redirect_to=/en']) {
    const result = evaluate(url); assert.equal(result?.status, 403); assert.equal(result.location, undefined);
  }
});
