import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='output/indexing-audit-2026-10-21';
const workbook=JSON.parse(await fs.readFile(`${root}/workbook.json`,'utf8'));
const http=JSON.parse(await fs.readFile(`${root}/http.json`,'utf8'));
const browser=JSON.parse(await fs.readFile(`${root}/browser-summary.json`,'utf8'));
const unchanged=createHash('sha256').update(await fs.readFile(workbook.source)).digest('hex')===workbook.sha256;
if(!unchanged)throw new Error('Source workbook changed');
const rowFor=url=>{
 const r=http.rows.find(r=>r.url===url),path=new URL(url).pathname;
 let finding='No confirmed technical indexing fault.',action='No speculative change.',evidence=`HTTP ${r.status}; rendered title/description/H1 present; self canonical; no noindex; live + local sitemap.`;
 if(path.includes('/product/')){finding='Full description absent from initial rendered main content; product name/GBP price present.';action='Retain existing local default-open description fix; deploy it.';evidence+=' Product JSON-LD description did not appear in main text.';if(path.startsWith('/en/'))evidence+=' Ordinary shop/category product anchors verified.';}
 if(browser.emptyCollections.includes(path)){finding='Live indexable collection has no product anchors.';action='Deploy already populated local collection/catalogue; retain URL.';evidence+=` Live product anchors 0; local ${/biker|giacche-biker|vestes-biker/.test(path)?14:1}.`;}
 return `| ${url} | ${finding} | ${action} | ${evidence} |`;
};
const english=workbook.urls.filter(u=>new URL(u).pathname.startsWith('/en/'));
const localized=workbook.urls.filter(u=>!english.includes(u));
const table=urls=>['| URL | Finding | Action taken / required | Evidence |','| --- | --- | --- | --- |',...urls.map(rowFor)].join('\n');
const sourceHash=createHash('sha256').update(await fs.readFile(workbook.source)).digest('hex');
const protectedFiles=await Promise.all(['public/.htaccess','public/legacy-not-found.html','public/robots.txt'].map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')]));
const report=`# Tuxar discovered-not-indexed audit — 21 October 2026

## Scope and result

Workbook Metadata!B3 confirms **Discovered - currently not indexed**. Table contains 202 unique URLs, including 35 English URLs and 12 English products. The source is unchanged (SHA-256 ${sourceHash}). No production website, database, Search Console setting or indexing request was changed during this audit.

All 202 report URLs and all 250 current live sitemap URLs returned HTTP 200 without redirects or X-Robots blocking. All 202 report pages plus the classic-button-trucker control were browser-rendered: titles, meta descriptions and H1s were present; all canonicals matched the requested URL; no noindex was found. One transient browser timeout on /it/privacy-policy succeeded on retry. No general rendering/indexability/canonical fault was demonstrated. This does not establish Google's selected canonical or indexing decision.

## Confirmed issues and implementation

1. **New local fix — saved SEO metadata ignored in production.** The 125 approved products carry seoTitle/seoDescription, but productSeoTitle/productSeoDescription used these only for local drafts. Production fell back to generated copy. Product now declares these optional fields and the route uses the saved values for English production pages. Other languages retain their existing localized/fallback behaviour. Test exercises all 125 saved titles/descriptions and verifies French copy is not replaced. This issue concerns the new release, not the historical cause for the 202 report URLs.
2. **Live description discoverability issue — already fixed locally.** All 100 rendered product pages sampled (99 in report plus trucker control) have names and GBP prices but their full description is absent from initial main content; it is present in Product JSON-LD and is behind the collapsed Description control. The existing local default-open Description accordion is preserved. Built preview confirms full descriptions visible without clicks on backpack and a new suede product. No rendering architecture change was made.
3. **Live empty collection mismatch — already fixed locally.** Biker and Racing, across all five languages, are currently indexable and in the live sitemap despite zero product anchors. The current approved local catalogue fills Biker with 14 products; existing verified Racing membership fills Racing with 1. Their URLs should remain in the NEW sitemap once this release is deployed. Do not remove populated routes or redirect unrelated products. Existing empty-collection noindex/sitemap guards are preserved; no new robots or canonical rule was introduced.

The legacy WordPress fixes, .htaccess and robots.txt were not edited. Existing reviews/ratings and product claims were not changed. No fake reviews, translation deletion, language consolidation, SSR migration or speculative rewrite was introduced.

## Server HTML versus rendered HTML

The 250 unauthenticated raw HTML responses share one SPA-shell body hash. They have no initial route title, canonical, product name/description/price or product anchors before JavaScript runs. Therefore server-delivered product content is **not present**. Browser rendering supplied metadata, names, prices, images and ordinary links successfully, consistent with the owner's Google live test. An empty app shell alone does not prove a rendering failure or justify rebuilding the architecture. Google's actual rendered HTML/WRS evidence remains a Search Console check. Early image naturalWidth=0 observations were not classified as blocked images; images were not all awaited during the batch crawl.

## Product discovery and orphan check

All 12 English report products have real a href links from /en/shop and their relevant category page. Eleven have assigned collections and were linked from applicable collection pages. aviator-g1-flight-jacket has no collection assignment; no assignment was invented. No priority product orphan was found. Live shop renders 22 product anchors; built release renders 147. The built Leather Jackets category has 138 links, bags 6, suits 1 and accessories 2; these cover the 147 products. Built browser checks cover all 14 populated collection pages. ProductCard remains a normal router Link with href; no click-only discovery was introduced.

## Sitemap and localized URLs

Live sitemap: 250 URLs. Local production sitemap: 890 URLs (147 products, 14 populated collections, 2 blog articles plus existing static routes, localized into five languages). Every live sitemap URL and all 202 report URLs remain in the current local sitemap. Live XML has zero missing/nonreciprocal alternate targets; all live alternate URLs returned 200. Local sitemap regression checks require reciprocal alternates, unique URLs and every approved product in each locale. Local source/loader checks and representative browser routes support the local destinations; this is not a claim of 890 live browser checks before deployment.

Non-English product pages commonly retain English product copy with translated navigation. This content/translation gap is not a proven technical indexing failure. Translations require review; no language was removed or canonicalized to English. New product slugs retain their fallback per-language route until translations are supplied.

### URLs to remove from the current local sitemap

**None.** No confirmed deleted/broken preferred URL was found. The 10 currently empty live Biker/Racing variants are populated in the release; remove them only if the owner decides not to publish those actual products. Missing indexation alone is not a removal criterion.

## English URL table (priority)

${table(english)}

## Remaining localized report URLs

${table(localized)}

## Search Console / log checks requiring owner access

- Do not resubmit /en/shop, /en/leather-jackets or the unchanged trucker URL repeatedly; their supplied live-test/indexing-request context is respected.
- After deployment, Live Test /en/product/atelier-backpack-noir and view tested HTML for the complete description without interaction, self canonical and image. This is a test of a changed page, not a promise or automatic indexing request.
- Live Test /en/collections/biker-jackets and /en/collections/racing-jackets after deployment: expect 14 and 1 direct product links respectively and no noindex. If the changed site-level issue is verified fixed, validate only the applicable Search Console issue category.
- Check one new product, /en/product/mens-tan-textured-collar-leather-bomber-jacket, for saved title/description and actual image. This new page is outside the historical report. A manual request is optional for an important genuinely new page after verification; no bulk/repeated requests are required.
- Inspect indexed records for last crawl, Google-selected canonical and referring pages. A successful live test does not establish indexed-state selection. Review Crawl Stats and cPanel access/error logs for verified Googlebot, historical 429/5xx/robots failures and response time trends; no server logs or Search Console account records were accessed.
- Allow natural recrawling. No manual indexing request is technically required by the findings on unchanged pages, and indexing is not guaranteed.

## Deployment and verification

Full local command npm run deploy:check passed (lint, both type checks, security tests, build, secret scan). Targeted indexing-content tests passed 4/4. Existing large-bundle/mixed-import build warnings remain, not suppressed. The existing database tests run only in local PostgreSQL; this audit executes no production SQL.

Use output/releases/tuxar-seo-catalogue-2026-10-21/tuxar-cpanel.zip, not the older catalogue ZIP. Extract the build contents into the confirmed cPanel document root after the private backup and existing backend compatibility gates. Include .htaccess, index.html, all assets, sitemap.xml, robots.txt, consent-default.js and legacy-not-found.html. Do not upload source, .env, SQL, reports or manifest.json. Keep old hashed assets for cached tabs; remove the uploaded ZIP from public hosting after extraction. The owner already reported a backup; verify it matches the current root before replacing files.

The owner supplied a database screenshot with 147 products, 601 variants and 659 images; this is context, not a new authenticated database audit or per-product stock verification. Do not rerun the insert-only catalogue SQL if it already succeeded. This frontend package does not deploy security migrations, Edge Functions or secrets. Review the existing production deployment plan before the full release.

After deployment, run node scripts/audit-current-indexing.mjs (read-only network); expect live sitemap to match 890 local URLs and metadata after JavaScript. Raw HTML still uses SPA rendering. Use browser Live Test/preview checks for route-specific tags. Check /en/shop, /en/leather-jackets, Biker/Racing and the sample product paths above; inspect browser console/network errors. Actual legacy response checks require Apache/cPanel, not Vite preview. Existing tested legacy rules are unchanged.

Protected file hashes: ${protectedFiles.map(([p,h])=>p+' '+h).join('; ')}.

Evidence: ${root}/workbook.json, http.json, live-sitemap.xml, live-robots.txt and browser-summary.json. Full checks are local; the live fixes remain pending owner deployment.
`;
await fs.writeFile('docs/indexing-audit-2026-10-21.md',report);
await fs.writeFile(`${root}/URL_FINDINGS.md`,table([...english,...localized])+'\n');
console.log(JSON.stringify({sourceUnchanged:unchanged,urls:workbook.urls.length,english:english.length,rows:english.length+localized.length,sitemapRemovals:0}));
