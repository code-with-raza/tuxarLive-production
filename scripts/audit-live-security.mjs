import fs from "node:fs/promises";
import { loadEnv } from "vite";
import { assertPublicEnvironment } from "./public-env.mjs";

// Read-only HEAD requests. Never send authenticated user or service-role credentials.
const report = { checkedAt: new Date().toISOString(), website: [], anonymousDatabase: [] };
for (const resource of ["/en", "/.env", "/.git/config", "/package.json", "/supabase/seed_catalog.sql"]) {
  try {
    const response = await fetch(`https://tuxar.co.uk${resource}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000) });
    report.website.push({ path: resource, status: response.status, contentType: response.headers.get("content-type"),
      cspPresent: response.headers.has("content-security-policy"), hstsPresent: response.headers.has("strict-transport-security"),
      nosniff: response.headers.get("x-content-type-options"), frameOptions: response.headers.get("x-frame-options") });
  } catch { report.website.push({ path: resource, error: "Connection failed or timed out" }); }
}
const environment = loadEnv("production", process.cwd(), "VITE_SUPABASE_");
assertPublicEnvironment(environment);
const url = environment.VITE_SUPABASE_URL;
const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
if (url && key) {
  for (const [table, column] of [["orders", "id"], ["order_items", "id"], ["customer_profiles", "user_id"], ["admin_users", "user_id"], ["customer_otp_challenges", "id"], ["contact_messages", "id"], ["newsletter_subscribers", "id"]]) {
    try {
      const response = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, { method: "HEAD", headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), Prefer: "count=exact" }, signal: AbortSignal.timeout(15000) });
      report.anonymousDatabase.push({ table, status: response.status, visibleCount: response.headers.get("content-range")?.split("/").pop() ?? null });
    } catch { report.anonymousDatabase.push({ table, error: "Connection failed or timed out" }); }
  }
}
await fs.mkdir("output/security", { recursive: true });
await fs.writeFile("output/security/live-security.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
