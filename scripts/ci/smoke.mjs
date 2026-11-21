const revision=process.env.GITHUB_SHA;
const site='https://tuxar.co.uk';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function read(url) {
  const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`Live check returned ${response.status}: ${new URL(url).pathname}`);
  return response;
}
try {
  let verified=false;
  for(let attempt=0;attempt<4;attempt++) {
    try { const response=await read(`${site}/deployment.json?release=${revision}`);if((await response.json()).revision===revision){verified=true;break;} } catch { /* Allow the hosting cache a bounded interval to refresh. */ }
    if(attempt<3) await pause(5000);
  }
  if(!verified) throw new Error('The live site did not serve this release revision');
  // HEAD only: verify private paths stay inaccessible without retrieving contents.
  for(const pathname of ['/.env','/.git/HEAD','/.backup.zip','/.env.example.zip']) {
    const response=await fetch(`${site}${pathname}`,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(![403,404,410].includes(response.status)) throw new Error(`Private path protection failed: ${pathname}`);
  }
  for(const locale of ['en','de','fr','it','es']) {
    const response=await read(`${site}/${locale}?release=${revision}`),html=await response.text();
    if(response.headers.get('x-content-type-options')!=='nosniff' || !response.headers.get('content-security-policy')) throw new Error(`Live ${locale} homepage is missing security headers`);
    if(!html.includes(`lang="${locale}"`) || !html.includes(`href="${site}/${locale}"`) || !/<h1\b/i.test(html)) throw new Error(`Live ${locale} homepage failed its language/canonical/content check`);
    const asset=html.match(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/)?.[1];
    if(!asset) throw new Error(`Live ${locale} homepage has no application script`);
    const javascript=await read(`${site}${asset}`);
    if(!/javascript/.test(javascript.headers.get('content-type')??'')) throw new Error('A JavaScript asset returned the wrong content type');
  }
  const sitemap=await (await read(`${site}/sitemap.xml?release=${revision}`)).text();
  if(!sitemap.includes('<urlset')) throw new Error('Live sitemap is invalid');
  for(const pathname of ['/seo-check-page-does-not-exist-20261119', `/missing-release-check-${revision}`, '/en/product/nonexistent-product-release-check', '/en/blog/nonexistent-article-release-check']) {
    const response=await fetch(`${site}${pathname}`,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const html=await response.text();
    if(response.status!==404 || response.headers.get('location') || !html.includes('Page not found') || !['/en','/en/shop','/en/contact'].every(path=>html.includes(`href="${path}"`))) throw new Error(`Real 404 response failed: ${pathname} (${response.status})`);
    console.log(`HTTP 404 verified: ${pathname}`);
  }
  for(const section of ['product','collections','blog']) {
    const url=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]).find(url=>new URL(url).pathname.startsWith(`/en/${section}/`));
    if(!url)throw new Error(`Missing valid ${section} control URL`);
    await read(url);
    console.log(`HTTP 200 verified: ${new URL(url).pathname}`);
  }
  const retired=await fetch(`${site}/taking-off-leather-jacket-from-behind-step-by-step-guide/`,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(retired.status!==410)throw new Error(`Intentional 410 changed: ${retired.status}`);
  console.log('HTTP 410 verified: retired article');
  console.log('Live release revision, private path protection, security headers, all five homepages, JavaScript and sitemap verified.');
} catch(error) { console.error(error.message);process.exitCode=1; }
