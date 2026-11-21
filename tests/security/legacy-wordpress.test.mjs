import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { evaluate, block, hosting } from '../helpers/wordpress-rewrite-model.mjs';
import { loadPolicy, begin, end } from '../../scripts/wordpress-retirement-policy.mjs';
const policy = await loadPolicy();
const decisions = policy.source.urls.map(row => ({ ...row, ...policy.decide(row.url) }));
const fixture = JSON.parse(await fs.readFile('tests/fixtures/legacy-wordpress-soft404.json', 'utf8'));

test('all Search Console sources and the earlier soft-404 export have specific same-page redirects or 410s', () => {
  assert.equal(decisions.length, 321);
  const legacy = decisions.filter(row => row.status !== 200);
  assert.equal(legacy.length, 103);
  assert.equal(legacy.filter(row => row.status === 301).length, 6);
  for (const row of legacy) {
    const actual = evaluate(row.url);
    assert.ok(actual, row.url);
    assert.equal(actual.status, row.status, row.url);
    assert.equal(actual.location, row.destination, row.url);
  }
  for (const url of fixture.urls) assert.equal(evaluate(url)?.status, 410, url);
  assert.ok(hosting.indexOf(begin) < hosting.indexOf('# BEGIN TUXAR ROOT LANGUAGE'));
  assert.ok(hosting.indexOf(end) < hosting.indexOf('# Keep one secure canonical host'));
  assert.ok(hosting.indexOf(end) < hosting.indexOf('RewriteRule . /server-router.php'));
  assert.match(block, /ErrorDocument 410 \/legacy-not-found\.html/);
  assert.match(block, /REDIRECT_STATUS\} \^\(404\|410\)\$/);
});

test('real GET and HEAD requests to the local rule model return terminal 410s and single 301s without cart cookies', async () => {
  const errorPage = await fs.readFile('public/legacy-not-found.html', 'utf8');
  const server = http.createServer((req, res) => {
    const match = evaluate(req.url);
    res.writeHead(match?.status ?? 200, { 'Content-Type': 'text/html', ...(match?.location ? { Location: match.location } : {}) });
    res.end(req.method === 'HEAD' ? undefined : match?.status === 410 ? errorPage : 'Current SPA test fixture');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const row of decisions.filter(row => row.status !== 200)) for (const method of ['GET', 'HEAD']) {
      const parsed = new URL(row.url);
      const response = await fetch(base + parsed.pathname + parsed.search, { method, redirect: 'manual' });
      assert.equal(response.status, row.status, method + ' ' + row.url);
      assert.equal(response.headers.get('location'), row.destination ?? null);
      assert.equal(response.headers.get('set-cookie'), null);
      if (method === 'GET' && row.status === 410) assert.equal(await response.text(), errorPage);
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('known current product aliases survive the retired namespace and resolve directly to English canonical products', () => {
  for (const [old, destination] of policy.maps) {
    assert.equal(evaluate(old)?.location, destination, old);
    assert.equal(evaluate(old.toUpperCase() + '/?utm_source=test')?.location, destination + '?utm_source=test', old);
    assert.equal(evaluate(old + '?add-to-cart=123')?.location, old === '/shop' || old === '/wishlist' ? undefined : destination);
    assert.equal(evaluate(new URL(destination).pathname), undefined, destination);
    if (old.startsWith('/product/')) {
      const slug = old.slice('/product/'.length);
      assert.equal(evaluate('/?product=' + slug + '&attribute_pa_size=l')?.location, destination);
      assert.equal(evaluate('/index.php?utm_source=test&PRODUCT=' + slug.toUpperCase())?.location, destination);
    }
  }
});
