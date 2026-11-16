import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";

async function moduleAt(path, context = {}, dev = true) {
  const source = (await fs.readFile(path, "utf8")).replaceAll("import.meta.env.DEV", String(dev));
  const exports = {};
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, { exports, ...context });
  return exports;
}
const women = JSON.parse(
  await fs.readFile("src/data/products/local-womens-jackets.json", "utf8"),
).products;

test("admin search includes the exact missing women product and tolerates smart apostrophes", async () => {
  const api = await moduleAt("src/lib/admin-catalogue-preview.ts");
  const name = "Women's Brown Round-Neck Leather Jacket";
  const rows = api.previewAdminRows([], women, "all");
  const matches = rows.filter((row) =>
    api
      .normaliseCatalogueSearch(row.name)
      .includes(api.normaliseCatalogueSearch(name.replace("'", "’"))),
  );
  assert.equal(matches.length, 1);
  assert.ok(matches[0].id.startsWith("preview--"));
  assert.equal(
    api.previewAdminRows([matches[0]], women, "all").filter((row) => row.slug === matches[0].slug)
      .length,
    0,
  );
  assert.equal(api.previewAdminRows([], women, "active").length, 0);
  assert.equal(matches[0].product_variants.length, 0);
});

test("preview edits persist without remote writes, reject inventory changes, and disappear in production", async () => {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  const api = await moduleAt("src/lib/catalogue-preview-edits.ts", { window });
  const source = women.find((product) => product.slug.includes("brown-round-neck"));
  api.savePreviewEdit("products", source.slug, {
    name: "Edited local jacket",
    priceGBP: 200,
    inStock: true,
    sizes: ["S"],
  });
  const product = api.previewProduct(source);
  assert.equal(product.name, "Edited local jacket");
  assert.equal(product.priceGBP, 200);
  assert.equal(product.inStock, false);
  assert.equal(product.sizes.length, 0);
  const reloaded = await moduleAt("src/lib/catalogue-preview-edits.ts", { window });
  assert.equal(reloaded.previewProduct(source).name, product.name);
  const collection = {
    slug: "women-puffer-jackets",
    title: "Cat Top Jacket",
    description: "Current description",
  };
  api.savePreviewEdit("categories", collection.slug, {
    title: "Edited Cat Top Jacket",
    metaIntro: "Edited SEO description",
    seoTitle: "Edited SEO title",
    sourceCollection: "puffer-jackets",
  });
  assert.equal(api.previewCollection(collection).title, "Edited Cat Top Jacket");
  assert.equal(api.previewCollection(collection).sourceCollection, undefined);
  const production = await moduleAt("src/lib/catalogue-preview-edits.ts", { window }, false);
  assert.equal(production.previewProduct(source).name, source.name);
  assert.throws(() => production.savePreviewEdit("products", source.slug, {}));
});

test("women category editor renders editable SEO and product editor links with no men products", async () => {
  const audience = await moduleAt("src/lib/product-audience.ts");
  const { COLLECTIONS, CATEGORY_META } = await moduleAt("src/data/product-types.ts", {
    require: () => ({ getProductAsset: (value) => value }),
  });
  const previews = await moduleAt("src/lib/catalogue-preview-edits.ts");
  const categories = await moduleAt("src/lib/catalogCategories.ts");
  const options = await moduleAt("src/lib/preview-category-options.ts", {
    require: (name) =>
      ({
        "@/data/products": { COLLECTIONS, CATEGORY_META },
        "@/lib/catalogCategories": categories,
        "@/lib/product-audience": audience,
      })[name],
  });
  const modules = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    sonner: { toast: {} },
    "@/data/products": { COLLECTIONS, PRODUCTS: women },
    "@/lib/local-catalogue": {
      LOCAL_JACKET_PRODUCTS: women,
      getLocalCatalogueProduct: (slug) => women.find((product) => product.slug === slug),
    },
    "@/lib/product-audience": audience,
    "@/lib/catalogue-preview-edits": previews,
    "@/lib/preview-category-options": options,
  };
  const api = await moduleAt("src/components/admin/PreviewCatalogueEditors.tsx", {
    require: (name) => modules[name],
  });
  const html = renderToStaticMarkup(
    React.createElement(api.PreviewCategoryEditor, { slug: "women-puffer-jackets", locale: "en" }),
  );
  assert.ok(html.includes("Cat Top Jacket"));
  assert.ok(html.includes("SEO title"));
  assert.ok(html.includes("SEO description"));
  assert.equal((html.match(/admin\/products\/preview--/g) ?? []).length, 3);
  assert.ok(!html.includes("Men&#x27;s"));
});

test("category pages no longer load or display journal stories", async () => {
  for (const path of [
    "src/routes/$locale.collections.$slug.tsx",
    "src/routes/$locale.$category.tsx",
    "src/components/site/CategoryView.tsx",
  ]) {
    const source = await fs.readFile(path, "utf8");
    assert.doesNotMatch(source, /Read Our Stories|From the Journal|getAllPosts|relatedPosts/);
  }
});
