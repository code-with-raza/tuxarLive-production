import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "vite";
import { assertPublicEnvironment } from "./public-env.mjs";

// No user/service credentials, POSTs, emails, mutations, row bodies or cookies.
const folder = path.resolve("output/production-security-2026-10-17");
const environment = { ...loadEnv("production", process.cwd(), "VITE_"), ...process.env };
assertPublicEnvironment(environment);
const api = new URL(environment.VITE_SUPABASE_URL);
if (api.origin !== "https://ncgxljatjajgcvnlrncm.supabase.co") throw new Error("Unexpected target: inspect and confirm the project before running probes");
const publicKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
if (!publicKey) throw new Error("A public Supabase key is required");
const report = { checkedAt: new Date().toISOString(), method: "HEAD and OPTIONS only, except public homepage HTML used to identify published assets", projectRef: api.hostname.split(".")[0], website: [], anonymousDatabase: [], cors: [], assets: [] };
const headerNames = ["content-type","content-security-policy","content-security-policy-report-only","strict-transport-security","x-content-type-options","referrer-policy","permissions-policy","x-frame-options","cache-control","server","location"];
const resources = ["http://tuxar.co.uk/en", "https://www.tuxar.co.uk/en", "https://tuxar.co.uk/en", ...["/en/login","/fr/shop","/.env","/.env.local","/.git/config","/package.json","/package-lock.json","/vite.config.ts","/src/main.tsx","/supabase/config.toml","/supabase/seed_catalog.sql","/SECURITY_AUDIT.md","/tuxar-cpanel-deploy.zip"].map((resource) => `https://tuxar.co.uk${resource}`)];
for (const resource of resources) {
  try {
    const response = await fetch(resource, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(12000) });
    report.website.push({ url: resource, status: response.status, headers: Object.fromEntries(headerNames.map((name) => [name, response.headers.get(name)])) });
  } catch { report.website.push({ url: resource, error: "Connection failed or timed out" }); }
}
try {
  const response = await fetch("https://tuxar.co.uk/en", { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (response.ok) {
    const html = await response.text();
    for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
      const asset = new URL(match[1], "https://tuxar.co.uk");
      if (asset.origin !== "https://tuxar.co.uk" || !asset.pathname.startsWith("/assets/")) continue;
      const head = await fetch(asset, { method: "HEAD", signal: AbortSignal.timeout(12000) });
      report.assets.push({ path: asset.pathname, status: head.status, contentType: head.headers.get("content-type") });
      const map = await fetch(`${asset.href}.map`, { method: "HEAD", signal: AbortSignal.timeout(12000) });
      report.assets.push({ path: `${asset.pathname}.map`, status: map.status, contentType: map.headers.get("content-type"), note: "HTML 200 is SPA fallback, not evidence of a source map" });
    }
  }
} catch { report.assets.push({ error: "Public HTML or asset check unavailable" }); }
const apiHeaders = { apikey: publicKey, ...(publicKey.startsWith("eyJ") ? { Authorization: `Bearer ${publicKey}` } : {}) };
for (const [table, column] of [["products","id"],["orders","id"],["order_items","id"],["customer_profiles","user_id"],["admin_users","user_id"],["customer_otp_challenges","id"],["contact_messages","id"],["newsletter_subscribers","id"],["customer_addresses","id"],["security_rate_limits","bucket_hash"]]) {
  try {
    const response = await fetch(`${api.origin}/rest/v1/${table}?select=${column}&limit=1`, { method: "HEAD", headers: { ...apiHeaders, Prefer: "count=exact" }, signal: AbortSignal.timeout(12000) });
    report.anonymousDatabase.push({ table, status: response.status, visibleCount: response.headers.get("content-range")?.split("/").pop() ?? null });
  } catch { report.anonymousDatabase.push({ table, error: "Connection failed or timed out" }); }
}
for (const name of ["submit-contact","create-checkout-session","dispatch-order"]) {
  for (const origin of ["https://tuxar.co.uk","https://untrusted.invalid"]) {
    try {
      const response = await fetch(`${api.origin}/functions/v1/${name}`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,apikey,content-type" }, signal: AbortSignal.timeout(12000) });
      report.cors.push({ function: name, origin, status: response.status, allowOrigin: response.headers.get("access-control-allow-origin"), allowMethods: response.headers.get("access-control-allow-methods") });
    } catch { report.cors.push({ function: name, origin, error: "Connection failed or timed out" }); }
  }
}
await fs.mkdir(folder, { recursive: true });
const destination = path.join(folder, `production-read-only-${new Date().toISOString().replace(/[:.]/g,"-")}.json`);
await fs.writeFile(destination, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(JSON.stringify({ destination, ...report }, null, 2));
