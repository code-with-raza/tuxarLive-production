import fs from 'node:fs/promises';
const locales = ['en','de','es','fr','it'];
const women = {
  'women-varsity-jackets': ['women-leather-hood-jackets','damen-lederjacken-kapuze','chaquetas-cuero-capucha-mujer','vestes-cuir-capuche-femme','giacche-pelle-cappuccio-donna'],
  'women-aviator-jackets': ['women-leather-round-jackets','damen-lederjacken-rundhals','chaquetas-cuero-cuello-redondo-mujer','vestes-cuir-col-rond-femme','giacche-pelle-collo-rotondo-donna'],
  'women-puffer-jackets': ['women-cat-top-jacket','damen-jacken-katzenohren-kapuze','chaquetas-capucha-orejas-gato-mujer','vestes-capuche-oreilles-chat-femme','giacche-cappuccio-orecchie-gatto-donna'],
  'women-shearling-jackets': ['women-zipper-jacket','damen-jacken-reissverschluss','chaquetas-cremallera-mujer','vestes-zippees-femme','giacche-zip-donna'],
  'women-racing-jackets': ['women-sperade-collar-jacket','damen-jacken-offener-kragen','chaquetas-cuello-abierto-mujer','vestes-col-ouvert-femme','giacche-collo-aperto-donna'],
  'women-motorcycle-suits': ['women-motorcycle-tops','damen-oberteile-motorrad-stil','tops-estilo-motorista-mujer','hauts-style-moto-femme','top-stile-motociclista-donna'],
};
let i18n = await fs.readFile('src/i18n/i18n.ts','utf8');
const typeSource = await fs.readFile('src/data/product-types.ts','utf8');
const shared = [...typeSource.match(/const WOMENS_SHARED_COLLECTIONS = \[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
const dictionaries = Object.fromEntries(await Promise.all(locales.map(async locale=>[locale,JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'))])));
const slugify = value => value.toLowerCase().replaceAll('ß','ss').replaceAll('œ','oe').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const additions = [];
for (const base of shared) {
  const key = `women-${base}`;
  const values = locales.map(locale=>locale==='en'?key:slugify(dictionaries[locale].collections[key].title));
  women[key] = values;
  if (!i18n.includes(`"${key}": {`)) additions.push(`  "${key}": {\n${locales.map((locale,index)=>`    ${locale}: "${values[index]}",`).join('\n')}\n  },`);
}
if (additions.length) {
  const start = i18n.indexOf('export const COLLECTION_SLUG_MAP');
  const end = i18n.indexOf('\n};',start);
  i18n = i18n.slice(0,end)+'\n'+additions.join('\n')+i18n.slice(end);
}
for (const [key,values] of Object.entries(women)) i18n = i18n.replace(new RegExp(`("${key}":\\s*\\{)([\\s\\S]*?)(\\n\\s*\\},)`), (all,start,body,end) => start + locales.reduce((text,locale,index)=>text.replace(new RegExp(`${locale}:\\s*"[^"]+"`), `${locale}: "${values[index]}"`),body) + end);
await fs.writeFile('src/i18n/i18n.ts',i18n);
const lines = ['# BEGIN TUXAR LOCALE ALIASES','  # Exact former URLs only; preserve legitimate query strings.'];
const rows = [];
const blogBlock = i18n.slice(i18n.indexOf('export const BLOG_SLUG_MAP'),i18n.indexOf('export const PRODUCT_SLUG_MAP'));
const articles = [...blogBlock.matchAll(/"([^"]+)":\s*\{([^}]+)\}/g)].map(([,canonical,body]) => ({ canonical, translations:Object.fromEntries([...body.matchAll(/(en|de|es|fr|it):\s*"([^"]+)"/g)].map(([,locale,slug]) => [locale,slug])) }));
for (const locale of locales) {
  const dict = JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`,'utf8'));
  for (const article of articles) for (const alias of Object.values(article.translations).filter(slug => slug !== article.translations[locale])) {
    const from = `/${locale}/blog/${alias}`, to = `https://tuxar.co.uk/${locale}/blog/${article.translations[locale]}`;
    lines.push(`  RewriteRule ^${from.slice(1)}/?$ ${to} [R=301,L,NE]`);
    rows.push({from,to});
  }
  for (const [canonical,product] of Object.entries(dict.products ?? {})) if (product.slug && product.slug !== canonical) {
    const from = `/${locale}/product/${canonical}`, to = `https://tuxar.co.uk/${locale}/product/${product.slug}`;
    lines.push(`  RewriteRule ^${from.slice(1)}/?$ ${to} [R=301,L,NE]`);
    rows.push({ from,to });
  }
  for (const [canonical,values] of Object.entries(women)) {
    const target = values[locales.indexOf(locale)];
    for (const alias of new Set([canonical,values[0]])) {
      const pattern = alias === target ? `${locale}/${alias}` : `${locale}/(?:collections/)?${alias}`;
      const to = `https://tuxar.co.uk/${locale}/collections/${target}`;
      lines.push(`  RewriteRule ^${pattern}/?$ ${to} [R=301,L,NE]`);
      rows.push({ from:`/${locale}/${alias}`,to });
    }
  }
}
lines.push('# END TUXAR LOCALE ALIASES');
let hosting = await fs.readFile('public/.htaccess','utf8');
if (hosting.includes(lines[0])) hosting = hosting.replace(/# BEGIN TUXAR LOCALE ALIASES[\s\S]*?# END TUXAR LOCALE ALIASES/,lines.join('\n'));
else hosting = hosting.replace('  # Current women',`${lines.join('\n')}\n\n  # Current women`);
await fs.writeFile('public/.htaccess',hosting);
await fs.mkdir('output/multilingual-audit-20261028',{recursive:true});
await fs.writeFile('output/multilingual-audit-20261028/exact-url-redirects.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify({ exactAliases:rows.length, locales }));
