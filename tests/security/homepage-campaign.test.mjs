import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as cloudinary from "../../src/lib/cloudinary.ts";
async function evaluate(file, modules) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(await fs.readFile(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      URL,
      require: (name) => {
        assert.ok(name in modules, name);
        return modules[name];
      },
    },
  );
  return exports;
}
const helpers = await evaluate("src/lib/homepage-campaign.ts", { "./cloudinary": cloudinary });
const row = {
  locale: "en",
  enabled: true,
  image_url: "https://images.example.com/campaign?id=123",
  destination_url: "/en/sales",
  title: "Halloween Sale",
  alt_text: "Autumn leather collection",
  button_label: "Shop the sale",
  image_width: 2172,
  image_height: 724,
};

test("published banners are locale-specific; disabled, unsafe or incomplete rows fall back to the slider", () => {
  assert.equal(helpers.homepageBannerFromRow(row, "en").href, "/en/sales");
  for (const locale of ["de", "es", "fr", "it"])
    assert.equal(helpers.homepageBannerFromRow(row, locale), null);
  for (const change of [
    { enabled: false },
    { image_url: "javascript:alert(1)" },
    { destination_url: "//evil.example" },
    { destination_url: "data:text/html,bad" },
    { title: "" },
    { alt_text: "" },
    { image_width: 0 },
  ])
    assert.equal(helpers.homepageBannerFromRow({ ...row, ...change }, "en"), null);
  assert.equal(helpers.homepageBannerFromRow(null, "en"), null);
});

test("image formats are not restricted by extension and destinations reject active URL schemes", () => {
  for (const image of [
    "https://cdn.example/photo",
    "https://cdn.example/a.gif",
    "https://cdn.example/a.svg",
    "https://cdn.example/a.avif?width=200",
  ])
    assert.equal(helpers.validBannerImageUrl(image), true);
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,bad",
    "http://cdn.example/a.png",
    "https://user:password@example.com/a.png",
  ])
    assert.equal(helpers.validBannerImageUrl(url), false);
  for (const url of ["/en/sales", "/fr/shop?category=bags", "https://example.com/sale"])
    assert.equal(helpers.validBannerDestination(url), true);
  for (const url of [
    "//example.com",
    "javascript:alert(1)",
    "mailto:a@example.com",
    "/en/ bad",
    "/" + String.fromCharCode(92) + "example.com",
  ])
    assert.equal(helpers.validBannerDestination(url), false);
});

test("external images retain their delivery URL and full dimensions; Cloudinary gets responsive images", async () => {
  const { HomepageCampaign } = await evaluate("src/components/site/HomepageCampaign.tsx", {
    "react/jsx-runtime": jsx,
    "@/lib/cloudinary": cloudinary,
    "@/lib/homepage-campaign": helpers,
  });
  const html = renderToStaticMarkup(
    React.createElement(HomepageCampaign, { campaign: helpers.homepageBannerFromRow(row, "en") }),
  );
  assert.match(html, /href="\/en\/sales"/);
  assert.match(html, /src="https:\/\/images.example.com\/campaign\?id=123"/);
  assert.match(html, /width="2172" height="724"/);
  assert.match(html, /class="block h-auto w-full"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(!html.includes("srcSet="));
  assert.ok(!html.includes("object-cover"));
  assert.equal(helpers.campaignImageSources(row.image_url), undefined);
  assert.ok(
    helpers
      .campaignImageSources("https://res.cloudinary.com/rllwk4bi/image/upload/a.png")
      .includes("c_fit"),
  );
});

test("database permissions allow public enabled reads and restrict writes to verified staff", async () => {
  const sql = await fs.readFile("supabase/migrations/202611050001_homepage_banners.sql", "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select to anon, authenticated using \(enabled\)/);
  assert.match(sql, /grant insert, update on public.homepage_banners to authenticated/);
  assert.match(sql, /for update to authenticated using \(public.is_admin/);
  assert.match(sql, /with check \(public.is_admin/);
  assert.ok(!sql.includes("grant insert, update on public.homepage_banners to anon"));
});
