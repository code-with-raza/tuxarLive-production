import { HttpError, readLimitedText } from "../_shared/http.ts";
import { orderDeliveryEstimate } from "../_shared/delivery.ts";
import { paymentMatches } from "../_shared/currency.ts";
const encoder = new TextEncoder();

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) return reply({ error: "Not configured" }, 503);

  let rawBody: string;
  try { rawBody = await readLimitedText(request, 1048576); }
  catch (error) { return reply({ error: "Invalid webhook body" }, error instanceof HttpError ? error.status : 400); }
  const signatureHeader = request.headers.get("stripe-signature") || "";
  const values = signatureHeader.split(",").map((part) => part.trim().split("="));
  const timestamp = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key]) => key === "v1").map(([, value]) => value)
    .filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !Number.isFinite(Number(timestamp)) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return reply({ error: "Invalid signature timestamp" }, 400);
  }
  const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`);
  if (!signatures.some((signature) => safeEqual(signature, expected))) {
    return reply({ error: "Invalid signature" }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return reply({ error: "Invalid webhook JSON" }, 400); }
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string" || !event.data?.object || typeof event.data.object !== "object") return reply({ error: "Invalid webhook event" }, 400);
  const session = event?.data?.object;
  if (event.type === "refund.updated" || event.type === "refund.failed") {
    const refundId = session?.id;
    if (typeof refundId === "string" && /^re_[A-Za-z0-9]+$/.test(refundId)) {
      const status = String(session.status || (event.type === "refund.failed" ? "failed" : "pending"));
      const update = { refund_status: status, ...(status === "succeeded" ? { payment_status: "refunded" } : {}) };
      const response = await fetch(`${supabaseUrl}/rest/v1/orders?stripe_refund_id=eq.${encodeURIComponent(refundId)}&select=id`, {
        method: "PATCH",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(update),
      });
      if (!response.ok) return reply({ error: "Refund status update failed" }, 500);
      const matched = await response.json();
      if (session.metadata?.order_id && !matched?.length) return reply({ error: "Refund order is not ready; retry event" }, 500);
    }
    return reply({ received: true });
  }
  const orderId = session?.metadata?.order_id;
  if (!orderId) return reply({ received: true });
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(orderId))) return reply({ error: "Invalid order reference" }, 400);

  const paymentCompleted = ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type);
  const paymentSettled = ["paid", "no_payment_required"].includes(session.payment_status);
  const checkoutEvent = paymentCompleted || ["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type);
  if (checkoutEvent) {
    const check = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=stripe_checkout_session_id,payment_method,total_pence,currency`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const order = check.ok ? (await check.json())?.[0] : null;
    if (!order) return reply({ error: "Checkout order is not ready; retry event" }, 500);
    if (order.payment_method !== "stripe" || order.stripe_checkout_session_id !== session.id) return reply({ error: "Checkout does not match this order" }, 400);
    if (paymentCompleted && paymentSettled && !paymentMatches(order,session)) return reply({ error: "Payment amount or currency does not match" }, 400);
  }

  let update: Record<string, unknown> | null = null;
  if (paymentCompleted && paymentSettled) {
    update = {
      payment_status: "paid",
      stripe_payment_intent_id: session.payment_intent || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
    update = { payment_status: "failed", updated_at: new Date().toISOString() };
  }

  if (update) {
    // A later authenticated success is authoritative over an earlier failure.
    // Paid/refunded/cancelled records must never be moved backwards by retries.
    const statusGuard = `&order_status=neq.cancelled&payment_status=${paymentCompleted ? "in.(pending,failed)" : "eq.pending"}`;
    const response = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}${statusGuard}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(update),
    });
    if (!response.ok) return reply({ error: "Order update failed" }, 500);
  }

  if (paymentCompleted && paymentSettled) {
    const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`,
      { headers },
    );
    if (!orderResponse.ok) return reply({ error: "Paid order could not be loaded" }, 500);
    const order = (await orderResponse.json())?.[0];
    if (!order) return reply({ error: "Paid order was not found" }, 500);
    if (order.order_status !== "cancelled" && order.payment_status === "paid" && !order.payment_email_sent_at) {
      const resend = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("ORDERS_FROM_EMAIL") || Deno.env.get("AUTH_FROM_EMAIL");
      if (!resend || !from) return reply({ error: "Order email sender is not configured" }, 503);
      const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
      const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency || "GBP" }).format(pence / 100);
      const items = (order.order_items || []).map((item: { product_name: string; size: string; color: string; quantity: number; unit_price_pence: number }) =>
        `<tr><td style="padding:10px;border-bottom:1px solid #ddd">${escape(item.product_name)}<br><small>${escape(item.size)} · ${escape(item.color)}</small></td><td style="padding:10px;border-bottom:1px solid #ddd">${item.quantity}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">${money(item.quantity * item.unit_price_pence)}</td></tr>`).join("");
      const email = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json", "Idempotency-Key": `card-payment-received-${order.id}` },
        body: JSON.stringify({
          from, to: [order.customer_email],
          subject: `Payment received for your Tuxar order ${order.order_number}`,
          html: `<div style="background:#f4f4f2;padding:36px 14px;font-family:Arial,sans-serif;color:#111"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #ddd"><div style="background:#111;color:#fff;padding:26px;text-align:center;font-family:Georgia,serif;font-size:28px;letter-spacing:5px">TUXAR</div><div style="padding:34px"><h1 style="font-family:Georgia,serif;font-weight:normal">Your payment has been received</h1><p>Dear ${escape(order.customer_name)},</p><p>Thank you for your order. Your secure card payment has been confirmed.</p><p><strong>Order:</strong> ${escape(order.order_number)}<br><strong>Amount paid:</strong> ${money(order.total_pence)}</p><table style="width:100%;border-collapse:collapse">${items}</table><p>${orderDeliveryEstimate(order.courier)}</p><p>We will email you again when your order is dispatched.</p><p>Questions? Contact <a href="mailto:tuxar.co@gmail.com">tuxar.co@gmail.com</a> and include your order number.</p><p>Thank you,<br>The Tuxar Team</p></div></div></div>`,
        }),
      });
      if (!email.ok) {
        console.error("Paid order email failed", email.status, await email.text());
        return reply({ error: "Payment recorded but confirmation email failed" }, 500);
      }
      const marked = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_email_sent_at=is.null`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ payment_email_sent_at: new Date().toISOString() }),
      });
      if (!marked.ok) return reply({ error: "Payment email status could not be saved" }, 500);
    }
  }

  return reply({ received: true });
});
