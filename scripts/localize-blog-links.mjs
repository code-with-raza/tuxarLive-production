import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
const exports = {};
const modules = {'@tanstack/react-router':{},'@/lib/catalogue-preview-edits':{previewCollection:value=>value}};
for(const locale of ['en','de','es','fr','it'])modules[`./locales/${locale}.json`]={default:JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'))};
vm.runInNewContext(ts.transpileModule(await fs.readFile('src/i18n/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>modules[name]});
let changedLinks=0,files=0;
for(const [canonical,translations]of Object.entries(exports.BLOG_SLUG_MAP))for(const [locale,slug]of Object.entries(translations)){
 const file=`src/content/blog/${slug}.md`;
 let markdown=await fs.readFile(file,'utf8');
 markdown=markdown.replace(/^canonical:.*$/m,`canonical: "/${locale}/blog/${slug}"`);
 markdown=markdown.replace(/\]\(((?:https:\/\/(?:www\.)?tuxar\.co\.uk)?\/[^\s)]+)\)/g,(match,href)=>{
  const url=new URL(href,'https://tuxar.co.uk');
  const parts=url.pathname.split('/').filter(Boolean);
  if(!['en','de','es','fr','it'].includes(parts[0]))return match;
  const sourceLocale=parts[0];parts[0]=locale;
  const type={product:'product',collections:'collection',blog:'blog'}[parts[1]];
  if(type&&parts[2])parts[2]=exports.getLocalizedSlug(exports.resolveSlug(parts[2],type,sourceLocale),type,locale);
  const target=`/${parts.join('/')}${url.search}${url.hash}`;
  if(target!==href)changedLinks++;
  return `](${target})`;
 });
 markdown=markdown.replaceAll('[/shop]',`[${exports.t('nav.shop',locale)}]`);
 await fs.writeFile(file,markdown);files++;
}
console.log(JSON.stringify({files,changedLinks}));
