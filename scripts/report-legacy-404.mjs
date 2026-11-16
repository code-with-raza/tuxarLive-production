import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out='output/legacy-404-audit-2026-10-18';
const fixture=JSON.parse(await fs.readFile('tests/fixtures/legacy-wordpress-404.json','utf8'));
const source=JSON.parse(await fs.readFile(`${out}/source-extract.json`,'utf8'));
const baseline=JSON.parse(await fs.readFile(`${out}/live-before-deployment.json`,'utf8'));
assert.equal(source.issue,fixture.issue);
assert.deepEqual(source.rows.map(row=>row.url),fixture.paths.map(target=>fixture.origin+target));
const candidates={
 'mens-white-racing-leather-jacket-vintage-biker-style-uk':'Possible white-racing-patch-jacket, but old SKU, patches and construction unverified.',
 'midnight-blue-white-leather-varsity-jacket':'Possible varsity-classic-edition Midnight Blue/White, but old leather-body description versus current wool body is unverified.',
 'urban-legend-black-white-varsity-jacket':'Current varsity lists Midnight Blue/White, Grey and Black/Beige, not Black/White; no verified equivalent.',
 'heritage-brown-leather-cafe-racer-jacket':'Possible distressed-cafe-racer; same colour/style alone does not establish identity.',
 'mens-leather-motorcycle-suit-one-piece':'Possible pro-track-racing-suit, but no historical SKU/image proof identifies the same suit.',
 'black-beige-retro-varsity-jacket':'Possible varsity-classic-edition Black/Beige; identity unverified. Old XXL variant is not in current S/M/L/XL sizes.',
 'leather-textile-motorcycle-gloves-2':'Two current goatskin/carbon gloves differ by colour; old numeric suffix does not identify the correct item.',
 'leather-textile-motorcycle-gloves':'Two current goatskin/carbon gloves differ by colour; old generic leather/textile name is insufficient.',
 'motorcycle-textile-saddle-bag':'Three current saddlebag designs exist; old textile name cannot identify which one.',
 'vintage-brown-aviator-leather-jacket-with-wwii-style-patches':'Possible heritage-patch-bomber; exact old patches, material and SKU unverified.',
};
function reason(url){
 const product=url.searchParams.get('product')||url.pathname.split('/').filter(Boolean).at(-1);
 if(url.pathname==='/shop/')return 'Verified current shop route in src/routes/$locale.shop.tsx; live GET /en/shop is 200 with no redirect. Drop all obsolete query parameters.';
 if(url.pathname==='/checkout/')return 'Obsolete cart action references unknown WooCommerce ID 2689. Block this action with 404; keep ordinary /checkout and /en/checkout unchanged.';
 if(url.searchParams.has('page_id'))return 'Old WordPress page ID 2777 has no recoverable title or identity. Owner decision needed; root homepage without this ID stays unchanged.';
 if(candidates[product])return candidates[product]+' Owner confirmation required before any 301; return 404 meanwhile.';
 if(/^\/(tag|product-tag|product-category)\//.test(url.pathname))return 'No matching current archive or verified old archive scope. Related modern collections are not proven identical; owner decision needed, 404 meanwhile.';
 if(!url.pathname.startsWith('/product/')&&!url.searchParams.has('product'))return 'No replacement among the two English journal articles (cognac jacket guide; Italian leather tanning). Related topics are not equivalent articles. Return 404; no removal permanence claim.';
 if(product.includes('a-2')||product.includes('a2-'))return 'No verified A-2 replacement. Current G-1 calfskin jackets do not establish equivalence to old A-2 horsehide/goatskin/air-force models. Owner decision needed; 404 meanwhile.';
 if(product.includes('puffer'))return 'No matching published puffer product. Do not map to unrelated leather outerwear or local-only drafts. Return 404, not an unproven permanent-removal 410.';
 if(product.startsWith('spidi')||product.startsWith('revit'))return 'No same branded/model product in current Tuxar catalogue. No proven equivalent; 404. Existing Revit soft-404 rule is reused where applicable.';
 return 'No historical identity mapping in catalogue, migrations or searched Git history. Similar biker/textile styles are not proof. Owner decision needed; 404 meanwhile.';
}
const decisions=fixture.paths.map((target,index)=>{
 const old=fixture.origin+target;
 const live=baseline.results.find(row=>row.original===old);
 assert.ok(live,old);
 const url=new URL(old);
 const redirect=url.pathname==='/shop/';
 return {old,currentResponse:live.cartQueryNotSent?`Exact cart query NOT SENT; bare path ${live.status??live.error}`:String(live.status??live.error),action:redirect?'301':'404 (unresolved / no verified replacement)',destination:redirect?'https://tuxar.co.uk/en/shop':'—',reason:reason(url),sourceRow:index+2};
});
async function walk(directory){const result=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await walk(file));else if(/\.(tsx?|jsx?|json|html|xml|txt|md)$/i.test(file))result.push(file);}return result;}
const matches=[];
for(const file of [...await walk('src'),...await walk('public')]){
 const text=await fs.readFile(file,'utf8');
 for(const row of decisions){
  const url=new URL(row.old);
  const target=url.pathname+url.search;
  // Exact quoted addresses, full URLs and legacy query identities, not substring
  // matches inside valid /en/shop or current route declarations.
  if(text.includes(row.old)||['"',"'",'`'].some(quote=>text.includes(quote+target+quote))||text.includes('>'+row.old+'<'))matches.push({file,url:row.old});
 }
}
const liveSitemap=await fs.readFile(`${out}/live-sitemap.xml`,'utf8');
const sitemapURLs=[...liveSitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1].replaceAll('&amp;','&'));
const liveSitemapMatches=decisions.filter(row=>sitemapURLs.includes(row.old)).map(row=>row.old);
await fs.writeFile(`${out}/url-decisions.json`,JSON.stringify({issue:source.issue,decisions,sourceLinkMatches:matches,liveSitemapMatches,liveSitemapURLCount:sitemapURLs.length},null,2));
const escape=value=>String(value).replaceAll('|','\\|');
const table=['| Old URL | Current response | Proposed action | Destination | Reason |','| --- | --- | --- | --- | --- |',...decisions.map(row=>'| '+[row.old,row.currentResponse,row.action,row.destination,row.reason].map(escape).join(' | ')+' |')].join('\n');
const header=`# Legacy WordPress 404 review\n\nReviewed 18 October 2026 (Asia/Karachi). Live probe timestamp (UTC): ${baseline.checkedAt}. Metadata confirms **Not found (404)**, 35 unique URLs. Source hashes and original last-crawled dates: output/legacy-404-audit-2026-10-18/source-extract.json.\n\n## Decision and evidence\n\nOne verified 301: old shop to the current shop. All other 34 entries receive real 404s in the local rule model. A 404 does not assert permanent removal; no 410s or speculative product/article redirects were added. Owners can confirm candidate identities below later. Three entries (two paths) overlap the previous 13-path soft-404 rules, which remain intact.\n\nAll 33 safely requested exact URLs and both cart URLs' bare paths currently return **200 text/html, no Location**, from LiteSpeed. Their body hashes match the current SPA HTML. This is pre-deployment evidence, not a successful fix. Both add-to-cart queries were deliberately not requested. The historical Search Console 404 dates do not describe today's responses.\n\nCurrent product/shop/category/collection/checkout/journal HTTP probes return 200 without redirects; robots.txt and sitemap.xml return 200 with the expected text/XML types. A SPA HTML 200 does not alone prove rendered UI functionality. Source route loaders and catalogue were also inspected. No checkout session, purchase, login, email, stock mutation or production deployment was performed.\n\n${table}\n\n## Catalogue and content comparison\n\nInspected src/data/products/{jackets,bags,suits,accessories}.ts, category/collection definitions in src/data/product-types.ts, src/content/blog/*.md, routing and sitemap. No historical SKU mapping was found in source, Supabase migrations, or targeted Git history searches. Current 22-item published catalogue and the two English articles are the basis; local-only draft products are not live replacements. Possible product matches above require owner confirmation, including variant/size differences. Old tags and categories are not automatically the same as a broad current collection.\n\n## Link audit\n\nExact old-address matches in scanned source/public text: ${matches.length}. Live sitemap: ${sitemapURLs.length} URLs, ${liveSitemapMatches.length} exact obsolete addresses. Route alias definitions such as /shop are not obsolete navigation links. No current links or sitemap entries needed editing. This is not an authenticated database-CMS or every-runtime-content crawl.\n\n## Verification boundaries\n\nLocal regression tests use actual GET/HEAD HTTP requests against a Node model of the reviewed RewriteRule/QUERY_STRING conditions. They are not native Apache/LiteSpeed execution. Native staging/deployed status, ErrorDocument behaviour, physical WordPress-directory conflicts and CDN/cache handling must still be checked. Vite dev/preview ignores .htaccess and is not valid evidence for these hosting rules. See DEPLOYMENT.md and VERIFICATION.md in the output folder.\n\nNo production fix is claimed. Intentionally removed/unmatched URLs may correctly remain in Search Console's Not found (404) report; do not make these indexable or redirect them to the homepage.\n`;
await fs.mkdir('docs',{recursive:true});
await fs.writeFile('docs/legacy-wordpress-404-review.md',header);
const hosting=await fs.readFile('public/.htaccess','utf8');
const start=hosting.indexOf('  # BEGIN TUXAR LEGACY WORDPRESS URLS');
const end=hosting.indexOf('  # END TUXAR LEGACY 404 EXPORT')+'  # END TUXAR LEGACY 404 EXPORT'.length;
await fs.writeFile(`${out}/legacy-rules-snippet.txt`,hosting.slice(start,end)+'\n');
console.log(JSON.stringify({decisions:decisions.length,redirects:decisions.filter(row=>row.action==='301').length,sourceLinkMatches:matches,liveSitemapMatches,liveSitemapURLCount:sitemapURLs.length},null,2));
