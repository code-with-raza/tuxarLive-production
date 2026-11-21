import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { verifyHomepageHtml } from '../../scripts/verify-homepage-html.mjs';

const page = locale => `<html lang="${locale}"><head><link rel="canonical" href="https://tuxar.co.uk/${locale}"></head><body><h1>Tuxar</h1><h2>Collections</h2>${['shop', 'leather-jackets', 'women-leather-jackets', 'contact', 'blog'].map(slug => `<a href="/${locale}/${slug}">${slug}</a>`).join('')}<script type="module" src="/assets/app.js"></script></body></html>`;

test('initial HTML requires one matching canonical, real headings and crawlable links for every language', () => {
  for (const locale of ['en', 'it', 'de', 'fr', 'es']) {
    assert.equal(verifyHomepageHtml(page(locale), locale).internalLinks, 5);
    assert.throws(() => verifyHomepageHtml(page(locale).replace('<h2>Collections</h2>', ''), locale));
    assert.throws(() => verifyHomepageHtml(page(locale).replace('rel="canonical"', 'rel="alternate"'), locale));
    assert.throws(() => verifyHomepageHtml(page(locale).replace('</head>', '<link rel="canonical" href="https://tuxar.co.uk/en"></head>'), locale));
    assert.throws(() => verifyHomepageHtml(page(locale).replace(/href="\//g, 'data-href="/').replace(/<a\b/g, '<span'), locale));
  }
});

test('validation rejects wrong language, draft content and missing app code', () => {
  assert.throws(() => verifyHomepageHtml(page('en'), 'fr'));
  assert.throws(() => verifyHomepageHtml(page('en').replace('</body>', 'Local catalogue preview</body>'), 'en'));
  assert.throws(() => verifyHomepageHtml(page('en').replace('/assets/app.js', '/src/main.tsx'), 'en'));
});

test('cPanel serves generated homepages before the SPA and the browser removes initial head tags before rendering', async () => {
  const apache = await fs.readFile('public/.htaccess', 'utf8');
  const rule = 'RewriteRule ^(en|it|de|fr|es)/?$ /prerender-home/$1.html [END]';
  assert.ok(apache.includes(rule));
  assert.ok(apache.indexOf(rule) < apache.indexOf('RewriteRule . /server-router.php'));
  assert.ok(apache.includes('RewriteCond %{DOCUMENT_ROOT}/prerender-home/$1.html -f'));
  const main = await fs.readFile('src/main.tsx', 'utf8');
  assert.ok(main.indexOf('data-tuxar-static-head') < main.indexOf('createRoot(document'));
  assert.ok(main.includes('tag => tag.remove()'));
  assert.equal(JSON.parse(await fs.readFile('package.json', 'utf8')).scripts.postbuild, 'node scripts/prerender-public-pages.mjs');
});
