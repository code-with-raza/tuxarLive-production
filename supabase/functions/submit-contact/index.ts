import { secureServe } from "../_shared/http.ts";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c]!);
secureServe("submit-contact", { auth: "public", limit: 3, emailLimit: 3, windowSeconds: 600 }, async (request) => {
  const payload = await request.json();
  if (payload.website) return Response.json({ ok: true });
  const limits: Record<string, number> = { name: 100, email: 254, subject: 150, message: 2000 };
  for (const [key, limit] of Object.entries(limits)) {
    const value = payload[key];
    if (typeof value !== "string" || !value.trim() || value.length > limit || value.includes(String.fromCharCode(0)) || (key !== "message" && /[\r\n]/.test(value))) return Response.json({ error: "Please check the form fields" }, { status: 400 });
  }
  const name = payload.name.trim(), email = payload.email.trim().toLowerCase(), subject = payload.subject.trim(), message = payload.message.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) return Response.json({ error: "Please check the form fields" }, { status: 400 });
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ error: "Contact service is not configured" }, { status: 503 });
  const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
  const saved = await fetch(`${url}/rest/v1/contact_messages`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ name, email, subject, message, locale: ["en", "de", "fr", "it", "es"].includes(payload.locale) ? payload.locale : "en" }) });
  const record = saved.ok ? (await saved.json())?.[0] : null;
  if (!record) return Response.json({ error: "We could not save your message" }, { status: 502 });
  const resend = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("CONTACT_FROM_EMAIL");
  let sent = false;
  if (resend && from) {
    const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json", "Idempotency-Key": `contact-${record.id}` }, body: JSON.stringify({ from, to: [Deno.env.get("CONTACT_NOTIFICATION_EMAIL") || "tuxar.co@gmail.com"], reply_to: email, subject: `New Tuxar enquiry: ${subject}`, text: `Name: ${name}\nEmail: ${email}\n\n${message}`, html: `<h2>New website enquiry</h2><p>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><h3>${escapeHtml(subject)}</h3><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` }) });
    sent = mail.ok;
  }
  await fetch(`${url}/rest/v1/contact_messages?id=eq.${record.id}`, { method: "PATCH", headers, body: JSON.stringify({ notification_status: sent ? "sent" : "failed", notified_at: sent ? new Date().toISOString() : null }) });
  return Response.json({ ok: true });
});
