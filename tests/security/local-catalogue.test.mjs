import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const catalogue = JSON.parse(await fs.readFile("src/data/products/local-jackets.json", "utf8"));
const approvedFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-01.json", "utf8"));
const secondFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-02.json", "utf8"));
const cafeRacerFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/cafe-racer-folder-03.json", "utf8"));
const crocFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/croc-folder-04.json", "utf8"));
const pufferFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/puffer-folder-05.json", "utf8"));
const frontPocketFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-06.json", "utf8"));
const twinStripeFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-07.json", "utf8"));
const threeColourFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-08.json", "utf8"));
const quiltedPatchFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-09.json", "utf8"));
const fourPocketCafeFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/cafe-racer-folder-10.json", "utf8"));
const doubleArmStripeFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/motorcycle-folder-11.json", "utf8"));
const yokePufferFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/puffer-folder-12.json", "utf8"));
const chevronPufferFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/puffer-folder-13.json", "utf8"));
const diamondQuiltPufferFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/puffer-folder-14.json", "utf8"));
const varsityFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/varsity-folder-15.json", "utf8"));
const ribTrimFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/leather-jackets-folder-16.json", "utf8"));
const contrastPanelFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/leather-jackets-folder-17.json", "utf8"));
const contrastCollarPufferFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/puffer-folder-18.json", "utf8"));
const graphicPanelFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/leather-jackets-folder-19.json", "utf8"));
const crossBackFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/suede-jackets-folder-20.json", "utf8"));
const suedeCollarFolder = JSON.parse(await fs.readFile("scripts/catalogue-inputs/suede-jackets-folder-21.json", "utf8"));
const approvedFolders = [approvedFolder, secondFolder, cafeRacerFolder, crocFolder, pufferFolder, frontPocketFolder, twinStripeFolder, threeColourFolder, quiltedPatchFolder, fourPocketCafeFolder, doubleArmStripeFolder, yokePufferFolder, chevronPufferFolder, diamondQuiltPufferFolder, varsityFolder, ribTrimFolder, contrastPanelFolder, contrastCollarPufferFolder, graphicPanelFolder, crossBackFolder];

approvedFolders.push(suedeCollarFolder);

test("local catalogue has unique colourways and ten units for each M/L/XL/XXL variant", () => {
  assert.equal(catalogue.localOnly, true);
  assert.equal(catalogue.publishReady, false);
  assert.equal(catalogue.products.length, 125, "Only the twenty-one individually supplied folders are active");
  assert.equal(catalogue.variants.length, catalogue.products.length * 4);
  assert.equal(catalogue.reviewedFamilies, 21);
  assert.deepEqual(catalogue.products.map(p => p.slug), approvedFolders.flatMap(folder => folder.colours.map(c => `mens-${c.key}-${folder.slugDesign || "colour-block"}-leather-${folder.slugStyle || "biker"}-jacket`)));
  assert.equal(new Set(catalogue.products.map(p => p.slug)).size, catalogue.products.length);
  assert.equal(new Set(catalogue.variants.map(v => v.sku)).size, catalogue.variants.length);
  for (const p of catalogue.products) {
    const folder = approvedFolders.find(folder => folder.batchId === p.batchId);
    assert.ok(folder);
    assert.deepEqual(p.collections, folder.collection ? [folder.collection] : []);
    assert.equal(p.itemGroupId, folder.itemGroupId);
    const colour = folder.colours.find(entry => p.slug === `mens-${entry.key}-${folder.slugDesign || "colour-block"}-leather-${folder.slugStyle || "biker"}-jacket`);
    assert.ok(colour);
    assert.equal(p.priceGBP, colour.priceGBP ?? folder.priceGBP);
    assert.ok(p.description.includes(folder.safetyNote));
    assert.deepEqual(p.sizes, ["M", "L", "XL", "XXL"]);
    assert.equal(p.colors.length, 1);
    assert.equal(p.currency, "GBP");
    assert.equal(p.reviewCount, 0);
    assert.equal(p.rating, 0);
    assert.equal(p.comparePriceGBP, undefined);
    assert.ok(p.priceGBP > 0);
    assert.ok(p.seoTitle.length <= 60);
    assert.ok(p.seoDescription.length <= 160);
    const variants = catalogue.variants.filter(v => v.productSlug === p.slug);
    assert.equal(variants.length, 4);
    for (const v of variants) {
      assert.equal(v.stock, 10);
      assert.equal(v.item_group_id, p.itemGroupId);
      assert.equal(v.image_url, null); // Never invent a Cloudinary URL.
      assert.equal(v.publishReady, false);
      assert.equal(v.sale_price, null); // No invented previous-price discount.
    }
  }
});

test("drafts are dev-only, absent from seed tools, blocked from cart and admin bulk import", async () => {
  const module = await fs.readFile("src/lib/local-catalogue.ts", "utf8");
  assert.match(module, /import\.meta\.env\.DEV && !import\.meta\.env\.SSR/);
  const page = await fs.readFile("src/routes/$locale.product.$slug.tsx", "utf8");
  const add = page.slice(page.indexOf("function handleAdd()"), page.indexOf("let safeQty", page.indexOf("function handleAdd()")));
  assert.match(add, /getLocalCatalogueProduct\(canonicalSlug\)/);
  assert.match(add, /ordering is disabled/i);
  assert.match(add, /return;/);
  assert.match(page, /disabled=\{Boolean\(getLocalCatalogueProduct\(canonicalSlug\)\) \|\| inventoryLoading/);
  assert.match(page, /Local draft — not available to order/);
  const inventory = page.slice(page.indexOf("const localDraft = getLocalCatalogueProduct(canonicalSlug)"));
  assert.ok(inventory.indexOf("return;") < inventory.indexOf("await supabase"));
  const admin = await fs.readFile("src/components/admin/AdminCatalog.tsx", "utf8");
  assert.match(admin, /STOREFRONT_PRODUCTS\.filter\(\(product\) => !getLocalCatalogueProduct\(product.slug\)\)/);
});

test("only the 602 selected clean images are active, with no promotional badge or invented keyword volume", async () => {
  const paths = new Set(catalogue.products.flatMap(p => p.gallery));
  for (const image of paths) {
    assert.match(image, /^\/src\/assets\/products\/local-jacket-import\/[a-z0-9-]+\.webp$/);
    const bytes = await fs.readFile(image.slice(1));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.toString("ascii", 12, 16), "VP8 ");
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, 1000);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, 1250);
  }
  assert.equal(paths.size, 602);
  const womens = JSON.parse(await fs.readFile("src/data/products/local-womens-jackets.json", "utf8"));
  assert.equal((await fs.readdir("src/assets/products/local-jacket-import")).length, 602 + womens.products.reduce((count, product) => count + product.gallery.length, 0));
  for (const folder of approvedFolders) {
    const selected = folder.colours.flatMap(c => c.views.map(v => v.id));
    assert.equal(new Set(selected).size, folder.colours.reduce((count, colour) => count + colour.views.length, 0));
    for (const excluded of folder.excludedImages) assert.ok(!selected.includes(excluded.id));
    assert.match(folder.keywordNote, /unverified/i);
  }
});

test("unapproved catalogue fixtures remain browser-development only and keep collection assignments", async () => {
  const source = await fs.readFile("src/lib/local-catalogue.ts", "utf8");
  const womens = JSON.parse(await fs.readFile("src/data/products/local-womens-jackets.json", "utf8"));
  function loadDrafts(dev, ssr) {
    const input = source.replaceAll("import.meta.env.DEV", String(dev)).replaceAll("import.meta.env.SSR", String(ssr));
    const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: specifier => {
      if (specifier === "@/lib/catalogue-preview-edits") return { previewProduct: product => product };
      if (specifier === "@/data/products/local-bags.json") return { default: { products: [] } };
      if (specifier === "@/assets") return { getProductAsset: value => value };
      if (specifier === "@/data/womens-inventory.json") return { default: { sizes: ['S','M','L','XL','2XL','3XL','4XL','5XL'], stockPerSizePerColour: 15 } };
      if (specifier === "@/data/products/approved-womens-catalogue.json") return { default: { products: [] } };
      assert.ok(["@/data/products/local-jackets.json", "@/data/products/local-womens-jackets.json"].includes(specifier));
      return { default: specifier.includes("local-womens") ? womens : catalogue };
    } });
    return exports.LOCAL_JACKET_PRODUCTS;
  }
  assert.equal(loadDrafts(false, false).length, 0);
  assert.equal(loadDrafts(true, true).length, 0);
  const drafts = loadDrafts(true, false);
  assert.equal(drafts.length, 125 + womens.products.length);
  assert.equal(drafts.filter(product => product.collections?.includes("cropped-jackets")).length, 8);
  const published = [];
  for (const name of ["jackets", "suits", "bags", "accessories"]) {
    const input = await fs.readFile(`src/data/products/${name}.ts`, "utf8");
    const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: specifier => {
      assert.equal(specifier, "@/assets");
      return { getProductAsset: value => value };
    } });
    published.push(...Object.values(exports).flat());
  }
  assert.equal(published.length, 22);
  assert.equal([...drafts, ...published].length, 147 + womens.products.length);
  assert.equal([...drafts, ...published].filter(p => p.collections?.includes("biker-jackets")).length, 14);
  assert.equal(drafts.filter(p => p.collections?.includes("cafe-racer-jackets")).length, 13);
  assert.equal(drafts.filter(p => p.collections?.includes("puffer-jackets")).length, 20);
  assert.equal(drafts.filter(p => p.collections?.includes("varsity-jackets")).length, 6);
  assert.equal([...drafts, ...published].filter(p => p.collections?.includes("motorcycle-jackets")).length, 43);
});
