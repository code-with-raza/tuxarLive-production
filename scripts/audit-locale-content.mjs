import fs from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
const locales = ['en', 'de', 'es', 'fr', 'it'];
const dictionaries = Object.fromEntries(await Promise.all(locales.map(async locale => [locale, JSON.parse(await fs.readFile(`src/i18n/locales/${locale}.json`, 'utf8'))])));
const products = (await Promise.all(['approved-catalogue', 'approved-womens-catalogue', 'approved-bags-catalogue'].map(async name => JSON.parse(await fs.readFile(`src/data/products/${name}.json`, 'utf8')).products))).flat();
const report = { locales: {}, names: products.map(p => p.name), specs: [...new Set(products.flatMap(p => p.specs.map(s => `${s.label}: ${s.value}`)))], materials: [...new Set(products.map(p => p.material))] };
const data = {};
vm.runInNewContext(ts.transpileModule(await fs.readFile('src/data/product-types.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: data, require: () => ({ getProductAsset: value => value }) });
report.collectionRecords = data.COLLECTIONS.map(c => ({ slug: c.slug, title: c.title }));
report.seedProducts = [];
for (const file of ['jackets','suits','bags','accessories']) {
  const seed = {};
  vm.runInNewContext(ts.transpileModule(await fs.readFile(`src/data/products/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:seed,require:()=>({getProductAsset:value=>value})});
  report.seedProducts.push(...Object.values(seed).find(Array.isArray).map(p=>({slug:p.slug,name:p.name,material:p.material,origin:p.origin,sizes:p.sizes,colors:p.colors.map(c=>c.name),specs:p.specs})));
}
for (const locale of locales) report.locales[locale] = { approvedProducts: products.length, missingProductTranslations: products.filter(p => !dictionaries[locale].products?.[p.slug]?.description).length, collections: Object.keys(dictionaries[locale].collections ?? {}).length, identicalCollectionTitles: Object.entries(dictionaries[locale].collections ?? {}).filter(([key, value]) => locale !== 'en' && value.title === dictionaries.en.collections?.[key]?.title).map(([key]) => key) };
await fs.mkdir('output/multilingual-audit-20261028', { recursive: true });
await fs.writeFile('output/multilingual-audit-20261028/content-inventory.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(process.argv.includes('--seeds') ? report.seedProducts : { locales: report.locales, collections: report.collectionRecords }));
