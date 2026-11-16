import { secureServe } from "../_shared/http.ts";
const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
const money = (pence: number, currency = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(pence / 100);
const reasons: Record<string, string> = {
  out_of_stock: "the item is no longer available in your selected option",
  quality_issue: "the item did not pass our pre-dispatch quality check",
  unable_to_fulfil: "we are unable to fulfil your order as expected",
  other: "an unexpected fulfilment issue has occurred",
};

secureServe("cancel-stripe-order", { auth: "staff", roles: ["owner", "admin"], limit: 10 }, async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const authorization = request.headers.get("Authorization") || "";
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization } });
    if (!userResponse.ok) return json({ error: "Sign in as staff first" }, 401);
    const user = await userResponse.json();
    const memberResponse = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=role`, { headers: { apikey: anon, Authorization: authorization } });
    const member = (await memberResponse.json())?.[0];
    if (!member || !["owner", "admin"].includes(member.role)) return json({ error: "Owner or admin permission required" }, 403);
    const { orderId, reasonCode, note, retryEmail } = await request.json();
    if (!/^[a-f0-9-]{36}$/i.test(String(orderId))) return json({ error: "Invalid order" }, 400);
    if (!retryEmail && !reasons[String(reasonCode)]) return json({ error: "Choose a valid cancellation reason" }, 400);
    const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const response = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`, { headers: serviceHeaders });
    const order = (await response.json())?.[0];
    if (!response.ok || !order) return json({ error: "Order not found" }, 404);
    if (order.payment_method !== "stripe") return json({ error: "This is not a card order" }, 409);
    if (retryEmail) {
      if (order.order_status !== "cancelled" || !order.stripe_refund_id || order.refund_email_sent_at) return json({ error: "No refund notice is awaiting delivery" }, 409);
    } else {
      if (order.order_status !== "pending" || order.payment_status !== "paid" || !order.stripe_payment_intent_id) return json({ error: "Only pending, paid card orders can be refunded here" }, 409);
      if (!stripeKey) return json({ error: "Stripe refund key is not configured" }, 503);
      // Reserve cancellation under a row lock before contacting Stripe. Dispatch
      // checks this marker atomically; a timeout leaves it reserved for safe retry.
      const prepared = await fetch(`${url}/rest/v1/rpc/prepare_stripe_cancellation`, {
        method: "POST", headers: { apikey: anon, Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ target_order: order.id }),
      });
      if (!prepared.ok) return json({ error: "Order changed or refund permission could not be checked. No refund was initiated" }, 409);
      const params = new URLSearchParams({ payment_intent: order.stripe_payment_intent_id, "metadata[order_id]": order.id });
      const refundResponse = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `tuxar-cancel-refund-${order.id}` },
        body: params,
      });
      const refund = await refundResponse.json();
      if (!refundResponse.ok || !refund.id) return json({ error: refund.error?.message || "Stripe did not accept the refund. Order was not cancelled." }, 502);
      if (!["pending", "succeeded"].includes(refund.status)) return json({ error: `Stripe refund is ${refund.status}; check Stripe before changing the order.` }, 409);
      const rpc = await fetch(`${url}/rest/v1/rpc/finalize_stripe_cancellation`, {
        method: "POST", headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ target_order: order.id, staff_user: user.id, cancellation_text: `${reasonCode}: ${String(note || "").slice(0, 400)}`, refund_id: refund.id, refund_state: refund.status }),
      });
      if (!rpc.ok) {
        const failure = await rpc.json().catch(() => ({}));
        return json({ error: `Stripe accepted refund ${refund.id}, but the order update failed: ${failure.message || "check Supabase logs"}. Do not initiate another refund manually.` }, 500);
      }
    }

    const savedCode = String(retryEmail ? order.cancellation_reason : reasonCode).split(":")[0];
    const from = Deno.env.get("ORDERS_FROM_EMAIL") || Deno.env.get("AUTH_FROM_EMAIL");
    const resend = Deno.env.get("RESEND_API_KEY");
    if (!from || !resend) return json({ cancelled: true, emailSent: false, emailError: "Order email sender is not configured." });
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json", "Idempotency-Key": `card-refund-notice-${order.id}` },
      body: JSON.stringify({
        from, to: [order.customer_email], subject: `Important update about Tuxar order ${order.order_number}`,
        html: `<div style="background:#f4f4f2;padding:36px 14px;font-family:Arial,sans-serif;color:#111"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #ddd"><div style="background:#111;color:#fff;padding:26px;text-align:center;font-family:Georgia,serif;font-size:28px;letter-spacing:5px">TUXAR</div><div style="padding:34px"><h1 style="font-family:Georgia,serif;font-weight:normal">We’re sorry about your order</h1><p>Dear ${escape(order.customer_name)},</p><p>We have cancelled order <strong>${escape(order.order_number)}</strong> because ${escape(reasons[savedCode] || reasons.other)}. We apologise for the inconvenience.</p><p>We have initiated a refund of <strong>${money(order.total_pence,order.currency||"GBP")}</strong> to your original card. Your bank or card provider determines when the funds appear on your statement.</p><p>If you need help, email <a href="mailto:tuxar.co@gmail.com">tuxar.co@gmail.com</a> with your order number.</p><p>Thank you for your understanding,<br>The Tuxar Team</p></div></div></div>`,
      }),
    });
    if (!email.ok) {
      const failure = await email.json().catch(() => ({}));
      return json({ cancelled: true, emailSent: false, emailError: failure.message || "Resend rejected the refund notice." });
    }
    await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: "PATCH", headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ refund_email_sent_at: new Date().toISOString() }),
    });
    return json({ cancelled: true, emailSent: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Refund request failed; check Edge Function and Stripe logs." }, 500);
  }
});
