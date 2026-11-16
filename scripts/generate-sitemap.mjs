import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://tuxar.co.uk";
const locales = ["en", "it", "de", "fr", "es"];

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

function extractBalanced(source, marker, opening, closing) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Could not find ${marker}`);
  const start = source.indexOf(opening, markerIndex + marker.length);
  if (start === -1) throw new Error(`Could not find ${opening} after ${marker}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  throw new Error(`Unbalanced ${opening}${closing} after ${marker}`);
}

function parseLocaleMap(source, exportName) {
  const body = extractBalanced(source, `export const ${exportName}`, "{", "}");
  const entries = [];
  const entryPattern = /"([^"]+)"\s*:\s*\{([\s\S]*?)\n\s*\},/g;
  for (const match of body.matchAll(entryPattern)) {
    const translations = {};
    for (const locale of locales) {
      const localeMatch = match[2].match(new RegExp(`${locale}:\\s*"([^"]+)"`));
      if (localeMatch) translations[locale] = localeMatch[1];
    }
    if (locales.every((locale) => translations[locale])) {
      entries.push({ canonical: match[1], translations });
    }
  }
  return entries;
}

function activeCollectionSlugs(source) {
  const marker = source.includes("const RAW_COLLECTIONS: Collection[] =")
    ? "const RAW_COLLECTIONS: Collection[] ="
    : "export const COLLECTIONS: Collection[] =";
  const body = extractBalanced(source, marker, "[", "]");
  const active = new Set();
  const entryPattern = /\{\s*slug:\s*"([^"]+)"([\s\S]*?)\n\s*\},/g;
  for (const match of body.matchAll(entryPattern)) {
    if (!/comingSoon:\s*true/.test(match[2])) active.add(match[1]);
  }
  return active;
}

function localizedGroup(pathByLocale) {
  return locales
    .map((locale) => {
      const url = `${siteUrl}${pathByLocale[locale]}`;
      const alternates = locales
        .map(
          (alternateLocale) =>
            `    <xhtml:link rel="alternate" hreflang="${alternateLocale}" href="${escapeXml(`${siteUrl}${pathByLocale[alternateLocale]}`)}" />`,
        )
        .join("\n");
      return [
        "  <url>",
        `    <loc>${escapeXml(url)}</loc>`,
        alternates,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${siteUrl}${pathByLocale.en}`)}" />`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");
}

const i18nSource = await readFile(path.join(projectRoot, "src/i18n/i18n.ts"), "utf8");
const productTypesSource = await readFile(
  path.join(projectRoot, "src/data/product-types.ts"),
  "utf8",
);

const products = parseLocaleMap(i18nSource, "PRODUCT_SLUG_MAP");
const localeDictionaries = Object.fromEntries(await Promise.all(locales.map(async locale => [locale, JSON.parse(await readFile(path.join(projectRoot, `src/i18n/locales/${locale}.json`), 'utf8'))])));
const approvedCatalogue = JSON.parse(await readFile(path.join(projectRoot, "src/data/products/approved-catalogue.json"), "utf8"));
const approvedWomensCatalogue = JSON.parse(await readFile(path.join(projectRoot, "src/data/products/approved-womens-catalogue.json"), "utf8"));
const approvedBagsCatalogue = JSON.parse(await readFile(path.join(projectRoot, "src/data/products/approved-bags-catalogue.json"), "utf8"));
const deploymentCatalogue = JSON.parse(await readFile(path.join(projectRoot, "src/data/products/deployment-catalogue.json"), "utf8"));
approvedCatalogue.products.push(...approvedWomensCatalogue.products, ...approvedBagsCatalogue.products, ...deploymentCatalogue.products);
approvedCatalogue.products = approvedCatalogue.products.map(product => ({ ...product, ...deploymentCatalogue.overrides[product.slug] }));
for (const product of approvedCatalogue.products) {
  if (!products.some((entry) => entry.canonical === product.slug)) {
    products.push({ canonical: product.slug, translations: Object.fromEntries(locales.map((locale) => [locale, localeDictionaries[locale].products?.[product.slug]?.slug || product.slug])) });
  }
}
const blogs = parseLocaleMap(i18nSource, "BLOG_SLUG_MAP");
const collectionMap = parseLocaleMap(i18nSource, "COLLECTION_SLUG_MAP");
const activeCollections = activeCollectionSlugs(productTypesSource);
// Do not publish empty collections or collections populated only by local drafts.
const publishedCollectionSlugs = new Set();
for (const product of approvedCatalogue.products) {
  for (const slug of product.collections ?? []) {
    // Shared membership IDs (e.g. best-sellers) still need the women's public page.
    const scoped = product.audience === "women" && collectionMap.some(collection => collection.canonical === `women-${slug}`)
      ? `women-${slug}` : slug;
    publishedCollectionSlugs.add(scoped);
  }
}
for (const file of ["jackets", "suits", "bags", "accessories"]) {
  const source = await readFile(
    path.join(projectRoot, `src/data/products/${file}.ts`),
    "utf8",
  );
  for (const match of source.matchAll(/collections:\s*\[([^\]]*)\]/g)) {
    for (const slug of match[1].matchAll(/"([^"]+)"/g)) {
      publishedCollectionSlugs.add(slug[1]);
    }
  }
}
for (const slug of publishedCollectionSlugs) {
  if (collectionMap.some(collection => collection.canonical === slug)) activeCollections.add(slug);
}
for (const slug of activeCollections) {
  if (!publishedCollectionSlugs.has(slug)) activeCollections.delete(slug);
}

const staticPaths = [
  "",
  "/shop",
  "/sales",
  "/leather-jackets",
  "/women-leather-jackets",
  "/motorcycle-suits",
  "/leather-bags",
  "/accessories",
  "/about",
  "/blog",
  "/contact",
  "/faq",
  "/size-guide",
  "/shipping-policy",
  "/returns-policy",
  "/privacy-policy",
  "/terms-conditions",
];

const groups = staticPaths.map((suffix) =>
  localizedGroup(Object.fromEntries(locales.map((locale) => [locale, `/${locale}${suffix}`]))),
);

for (const product of products) {
  groups.push(
    localizedGroup(
      Object.fromEntries(
        locales.map((locale) => [locale, `/${locale}/product/${product.translations[locale]}`]),
      ),
    ),
  );
}

for (const collection of collectionMap.filter((item) => activeCollections.has(item.canonical))) {
  groups.push(
    localizedGroup(
      Object.fromEntries(
        locales.map((locale) => [
          locale,
          `/${locale}/collections/${collection.translations[locale]}`,
        ]),
      ),
    ),
  );
}

for (const blog of blogs) {
  groups.push(
    localizedGroup(
      Object.fromEntries(
        locales.map((locale) => [locale, `/${locale}/blog/${blog.translations[locale]}`]),
      ),
    ),
  );
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...groups,
  "</urlset>",
  "",
].join("\n");

await writeFile(path.join(projectRoot, "public/sitemap.xml"), sitemap, "utf8");
console.log(
  `Generated sitemap with ${groups.length * locales.length} localized URLs ` +
    `(${products.length} products, ${activeCollections.size} active collections, ${blogs.length} articles).`,
);
