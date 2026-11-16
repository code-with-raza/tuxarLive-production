import { secureServe } from "../_shared/http.ts";
secureServe("subscribe-newsletter", { auth: "public", limit: 5, emailLimit: 3, windowSeconds: 3600 }, async (request) => {
  const payload = await request.json();
  if (payload.website) return Response.json({ ok: true });
  if (typeof payload.email !== "string" || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return Response.json({ error: "Enter a valid email" }, { status: 400 });
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ error: "Subscriptions are not configured" }, { status: 503 });
  const now = new Date().toISOString();
  const saved = await fetch(`${url}/rest/v1/newsletter_subscribers?on_conflict=email`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email: payload.email.trim().toLowerCase(), locale: ["en", "de", "fr", "it", "es"].includes(payload.locale) ? payload.locale : "en", status: "active", consented_at: now, updated_at: now }) });
  return saved.ok ? Response.json({ ok: true }) : Response.json({ error: "Subscription could not be saved" }, { status: 502 });
});
