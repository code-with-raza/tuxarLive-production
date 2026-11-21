import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("hosting policy keeps SPA assets public while denying sensitive files and staging CSP safely", async () => {
  const source = await fs.readFile("public/.htaccess", "utf8");
  const pattern = source.match(/<FilesMatch "\(\?i\)([^"]+)"/)[1];
  const denied = new RegExp(pattern, "i");
  for (const file of [".env", ".git", "package.json", "package-lock.json", "vite.config.ts", "backup.zip", "backup.rar", "backup.7z", "backup.tgz", "backup.tar.gz", "database.sqlite3", "database.db", "private.pfx", "deploy.ps1", "seed.py", "config.ini", "key.pem", "script.js.map"]) assert.ok(denied.test(file), file);
  for (const file of ["index.html", "consent-default.js", "index-AbCdEf12.js", "image.webp", "favicon.svg"]) assert.ok(!denied.test(file), file);
  assert.match(source, /RewriteRule \. \/server-router\.php \[END\]/);
  assert.match(source, /<Files "server-routes\.json">\s*Require all denied/);
  assert.match(source, /Header always set Content-Security-Policy "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"/);
  assert.match(source, /Content-Security-Policy-Report-Only "default-src 'self'/);
  assert.match(source, /connect-src [^;]*https:\/\/\*\.supabase.co[^;]*https:\/\/api.cloudinary.com/);
  assert.match(source, /Strict-Transport-Security "max-age=300"/);
  const hstsLine = source.split("\n").find((line) => /Header always set Strict-Transport-Security/.test(line));
  assert.doesNotMatch(hstsLine, /includeSubDomains|preload/);
});

test("repository folder guard blocks source and backup directories without matching storefront routes", async () => {
  const source = await fs.readFile('public/.htaccess','utf8');
  const rule = source.match(/RewriteRule (\^\(\?:\\\.git\|[^\s]+) - \[F,L,NC\]/);
  assert.ok(rule);
  const denied = new RegExp(rule[1],'i');
  for (const path of ['.git/config','.svn/entries','.hg/store','src/main.tsx','supabase/config.toml','scripts/deploy.ps1','tests/security/http.test.mjs','output/releases/archive','docs/security.md','node_modules/zod/package.json']) assert.ok(denied.test(path),path);
  for (const path of ['en','de/shop','fr/product/jacket','es/checkout','it/cart','en/admin','assets/index-AbCdEf12.js','prerender-pages/en/shop/index.html','robots.txt','sitemap.xml']) assert.equal(denied.test(path),false,path);
});
