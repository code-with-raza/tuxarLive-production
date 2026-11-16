import { secureServe } from "../_shared/http.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status });
secureServe("verify-customer-otp", { auth: "user", limit: 15, windowSeconds: 600 }, async (request, { user }) => {
  const { code } = await request.json();
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return json({ error: "Enter the complete six-digit code" }, 400);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), pepper = Deno.env.get("OTP_PEPPER");
  if (!url || !service || !pepper) return json({ error: "Verification is not configured" }, 503);
  const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${user!.id}:${code}:${pepper}`));
  const suppliedHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const checked = await fetch(`${url}/rest/v1/rpc/consume_customer_otp`, { method: "POST", headers, body: JSON.stringify({ target_user: user!.id, supplied_hash: suppliedHash }) });
  if (!checked.ok) return json({ error: "Verification is temporarily unavailable" }, 503);
  if (await checked.json() !== true) return json({ error: "Code is invalid, expired, or already used" }, 400);
  const now = new Date().toISOString();
  const update = await fetch(`${url}/rest/v1/customer_profiles?user_id=eq.${user!.id}&account_status=neq.disabled`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ tuxar_verified: true, verified_at: now, account_status: "active", updated_at: now }) });
  if (!update.ok || !(await update.json())?.length) return json({ error: "Account activation could not be completed" }, 503);
  return json({ verified: true });
});
