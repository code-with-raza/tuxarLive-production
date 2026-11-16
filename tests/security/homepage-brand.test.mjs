import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import ts from 'typescript';

const hosting = await fs.readFile('public/.htaccess', 'utf8');
const languageStart = hosting.indexOf('# BEGIN TUXAR ROOT LANGUAGE');
const languageEnd = hosting.indexOf('# END TUXAR ROOT LANGUAGE');
const block = hosting.slice(languageStart, languageEnd);
const rules = [];
let condition;
for (const line of block.split('\n')) {
  const match = line.match(/^\s*RewriteCond %\{HTTP:(Cookie|Accept-Language)\} (\S+)(?: \[(NC)\])?$/);
  if (match) condition = { header: match[1].toLowerCase(), regex: new RegExp(match[2].replaceAll('[[:space:]]', '\\s'), match[3] ? 'i' : '') };
  const rule = line.match(/^\s*RewriteRule (\^\$) (\S+) \[R=302,L\]$/);
  if (rule) { rules.push({ pattern: new RegExp(rule[1]), destination: rule[2], condition }); condition = undefined; }
}
function target(pathname, headers = {}) {
  for (const rule of rules) {
    if (!rule.pattern.test(pathname.slice(1))) continue;
    const match = rule.condition?.regex.exec(headers[rule.condition.header] || '');
    if (rule.condition && !match) continue;
    return rule.destination.replace('%2', match?.[2] || '');
  }
  return null;
}

test('temporary root language selection follows legacy guards and preserves localized routes', () => {
  assert.equal(rules.length, 6);
  const position = languageStart;
  assert.ok(position > hosting.indexOf('# END TUXAR WORDPRESS RETIREMENT'));
  assert.ok(position < hosting.indexOf('# Keep one secure canonical host'));
  assert.ok(position < hosting.indexOf('RewriteRule . /index.html'));
  assert.equal(target('/'), 'https://tuxar.co.uk/en');
  for (const path of ['en', 'fr', 'en/shop', 'en/checkout', 'en/product/classic-button-trucker', 'assets/main.js', 'robots.txt', 'sitemap.xml']) {
    assert.equal(target('/' + path), null, path);
  }
  assert.ok(hosting.indexOf('product|page_id|p|paged|post_type|add-to-cart') < position);
  assert.ok(hosting.indexOf('(^|&)product=') < position);
  assert.doesNotMatch(block, /R=301/);
  assert.match(hosting, /Header always merge Vary "Accept-Language"/);
  assert.match(hosting, /Header always merge Vary "Cookie"/);
  assert.match(hosting, /Header always set Cache-Control "private, no-store" "expr=%\{REQUEST_URI\} == '\/'"/);
});

test('parsed language rules honor saved choice then primary browser language, rejecting invalid locales', () => {
  for (const [header, locale] of [['it-IT,it;q=0.9,en;q=0.8','it'], ['de-DE,de;q=0.9','de'], ['fr-FR,fr;q=0.9','fr'], ['es-ES,es;q=0.9','es'], ['en-GB,fr;q=0.9','en'], ['nl-NL','en'], ['', 'en'], ['FR-ca,en;q=0.9','fr']]) {
    assert.equal(target('/', {'accept-language': header}), `https://tuxar.co.uk/${locale}`);
  }
  assert.equal(target('/', {cookie:'other=1; tuxar-locale=es; test=2', 'accept-language':'de-DE'}), 'https://tuxar.co.uk/es');
  for (const cookie of ['tuxar-locale=../../admin', 'not-tuxar-locale=fr', 'tuxar-locale=france', 'tuxar-locale=xx']) {
    assert.equal(target('/', {cookie, 'accept-language':'it-IT'}), 'https://tuxar.co.uk/it');
  }
});

test('language rule HTTP model redirects once and retains attribution queries', async (context) => {
  // HTTP model of the inspected rules, not a native Apache engine test.
  const server = http.createServer((request, response) => {
    const incoming = new URL(request.url, 'http://localhost');
    const destination = target(incoming.pathname, request.headers);
    if (destination) {
      response.writeHead(302, { Location: destination + incoming.search, Vary: 'Accept-Language, Cookie', 'Cache-Control': 'private, no-store' });
    } else {
      response.writeHead(200);
    }
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const suffix of ['/', '/?utm_source=google&utm_campaign=brand']) {
    const response = await fetch(origin + suffix, { redirect: 'manual', headers: {'Accept-Language':'fr-FR,fr;q=0.9'} });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://tuxar.co.uk/fr' + new URL(origin + suffix).search);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const destination = await fetch(origin + '/en', { redirect: 'manual' });
  assert.equal(destination.status, 200);
  assert.equal(destination.headers.get('location'), null);
});

test('client language selection handles saved preferences and blocked storage without overriding explicit URLs', async () => {
  const code = ts.transpileModule(await fs.readFile('src/i18n/preferred-locale.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const exports = {};
  const document = {cookie: ''};
  vm.runInNewContext(code, {exports, document, navigator: {language:'de-DE'}, location: {protocol:'https:'}, window: {localStorage: {getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}}});
  assert.equal(exports.browserLocale(), 'de');
  assert.equal(exports.preferredLocale('tuxar-locale=fr', 'it', 'de-DE'), 'fr');
  assert.equal(exports.preferredLocale('', 'it', 'de-DE'), 'it');
  assert.equal(exports.preferredLocale('', '../../admin', 'es-ES'), 'es');
  assert.equal(exports.preferredLocale('', null, 'nl-NL'), 'en');
  for (const locale of ['en','it','de','fr','es']) assert.equal(exports.preferredLocale('', null, locale + '-XX'), locale);
  exports.saveLocale('fr');
  assert.match(document.cookie, /^tuxar-locale=fr; path=\//);
  assert.match(document.cookie, /SameSite=Lax; Secure$/);
  const layout = await fs.readFile('src/routes/$locale.tsx', 'utf8');
  assert.doesNotMatch(layout, /navigator\.language|browserLocale\(/);
  assert.match(layout, /document\.documentElement\.lang = locale/);
  const root = await fs.readFile('src/routes/index.tsx', 'utf8');
  assert.match(root, /locale = browserLocale\(\)/);
});

test('English homepage brand and genuine site-name alternative retain localized canonicals', async () => {
  const home = await fs.readFile('src/routes/$locale.index.tsx', 'utf8');
  const root = await fs.readFile('src/routes/__root.tsx', 'utf8');
  assert.ok(home.includes('Tuxar | Men\'s Leather Jackets, Bags & Motorcycle Gear'));
  assert.ok(home.includes('const canonicalUrl = absoluteUrl(`/${locale}`)'));
  assert.match(home, /localizedAlternates\(\(targetLocale\) => `\/\$\{targetLocale\}`\)/);
  assert.match(root, /"@type": "WebSite",\s+name: "Tuxar",\s+alternateName: "Tuxar\.co\.uk",\s+url: "https:\/\/tuxar\.co\.uk"/);
});
