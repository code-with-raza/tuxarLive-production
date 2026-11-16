import { secureServe } from "../_shared/http.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status });
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
secureServe("verify-email-registration", { auth: "public", limit: 20, emailLimit: 10, windowSeconds: 600 }, async (request) => {
  const { email, code } = await request.json();
  if (typeof email !== "string" || typeof code !== "string" || !/^\d{6}$/.test(code)) return json({ error: "Enter the email address and complete six-digit code" }, 400);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), pepper = Deno.env.get("OTP_PEPPER");
  if (!url || !service || !pepper) return json({ error: "Verification is not configured" }, 503);
  const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
  const response = await fetch(`${url}/rest/v1/customer_profiles?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&tuxar_verified=eq.false&account_status=eq.pending&select=user_id&limit=1`, { headers });
  if (!response.ok) return json({ error: "Verification is temporarily unavailable" }, 503);
  const profile = (await response.json())?.[0];
  if (!profile) return json({ error: "Code is invalid, expired, or already used" }, 400);
  const check = await fetch(`${url}/rest/v1/rpc/consume_customer_otp`, { method: "POST", headers, body: JSON.stringify({ target_user: profile.user_id, supplied_hash: await sha256(`${profile.user_id}:${code}:${pepper}`) }) });
  if (!check.ok) return json({ error: "Verification is temporarily unavailable" }, 503);
  if (await check.json() !== true) return json({ error: "Code is invalid, expired, or already used" }, 400);
  const unban = await fetch(`${url}/auth/v1/admin/users/${profile.user_id}`, { method: "PUT", headers, body: JSON.stringify({ ban_duration: "none", email_confirm: true }) });
  if (!unban.ok) return json({ error: "Activation failed. Request a new code and try again" }, 503);
  const now = new Date().toISOString();
  const update = await fetch(`${url}/rest/v1/customer_profiles?user_id=eq.${profile.user_id}&account_status=eq.pending`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ tuxar_verified: true, verified_at: now, account_status: "active", updated_at: now }) });
  if (!update.ok || !(await update.json())?.length) return json({ error: "Account activation could not be completed" }, 503);
  return json({ verified: true });
});
