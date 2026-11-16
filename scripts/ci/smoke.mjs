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
  for(const locale of ['en','de','fr','it','es']) {
    const response=await read(`${site}/${locale}?release=${revision}`),html=await response.text();
    if(!html.includes(`lang="${locale}"`) || !html.includes(`href="${site}/${locale}"`) || !/<h1\b/i.test(html)) throw new Error(`Live ${locale} homepage failed its language/canonical/content check`);
    const asset=html.match(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/)?.[1];
    if(!asset) throw new Error(`Live ${locale} homepage has no application script`);
    const javascript=await read(`${site}${asset}`);
    if(!/javascript/.test(javascript.headers.get('content-type')??'')) throw new Error('A JavaScript asset returned the wrong content type');
  }
  const sitemap=await (await read(`${site}/sitemap.xml?release=${revision}`)).text();
  if(!sitemap.includes('<urlset')) throw new Error('Live sitemap is invalid');
  console.log('Live release revision, all five homepages, JavaScript and sitemap verified.');
} catch(error) { console.error(error.message);process.exitCode=1; }
