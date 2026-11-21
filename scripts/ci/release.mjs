import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export async function releaseManifest(root,revision) {
  if(!/^[0-9a-f]{40}$/.test(revision??'')) throw new Error('A full Git commit SHA is required');
  const files=[];
  async function walk(folder) {
    for(const entry of await fs.readdir(folder,{withFileTypes:true})) {
      const full=path.join(folder,entry.name),relative=path.relative(root,full).replaceAll('\\','/');
      if(entry.isSymbolicLink()) throw new Error('Symlinks are forbidden in deployment files');
      if(entry.isDirectory()) { if(!/^(assets|blog_images|size-charts|prerender-home|prerender-pages)(\/|$)/.test(relative)) throw new Error(`Unexpected deployment directory: ${relative}`);await walk(full); }
      else {
        if(!/^(?:\.htaccess|index\.html|robots\.txt|sitemap\.xml|llms\.txt|legacy-not-found\.html|server-router\.php|server-routes\.json|consent-default\.js|favicon\.svg|deployment\.json|(?:assets|blog_images|size-charts)\/[a-zA-Z0-9_./-]+\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|ico)|prerender-home\/(?:en|de|fr|it|es)\.html|prerender-pages\/(?:en|de|fr|it|es)\/(?:[a-z0-9-]+\/)+index\.html)$/.test(relative)) throw new Error(`Unexpected public file: ${relative}`);
        const content=await fs.readFile(full);files.push({path:relative,bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')});
      }
    }
  }
  await walk(root);
  for(const required of ['index.html','.htaccess','robots.txt','sitemap.xml','deployment.json',...['en','de','fr','it','es'].map(locale=>`prerender-home/${locale}.html`)]) if(!files.some(file=>file.path===required)) throw new Error(`Missing release file: ${required}`);
  if(!files.some(file=>file.path.startsWith('prerender-pages/en/product/'))) throw new Error('Product prerendering is missing');
  if(JSON.parse(await fs.readFile(path.join(root,'deployment.json'),'utf8')).revision!==revision) throw new Error('Release revision mismatch');
  return {revision,files:files.sort((a,b)=>a.path.localeCompare(b.path))};
}

async function main() {
  if(process.argv.includes('--current-commit')) {
    const {GITHUB_TOKEN,GITHUB_REPOSITORY,GITHUB_REF_NAME,GITHUB_SHA}=process.env;
    const response=await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${encodeURIComponent(GITHUB_REF_NAME)}`,{headers:{Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
    if(!response.ok || (await response.json()).sha!==GITHUB_SHA) throw new Error('This deployment is no longer the branch head. Deploy the latest commit instead.');
    return;
  }
  const revision=process.env.GITHUB_SHA;
  if(!/^[0-9a-f]{40}$/.test(revision??'')) throw new Error('GITHUB_SHA is missing');
  await fs.writeFile('dist/deployment.json',JSON.stringify({revision})+'\n');
  const manifest=await releaseManifest(path.resolve('dist'),revision);
  await fs.mkdir('output/ci',{recursive:true});
  await fs.writeFile('output/ci/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  console.log(`Verified ${manifest.files.length} public files for ${revision.slice(0,12)}`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
