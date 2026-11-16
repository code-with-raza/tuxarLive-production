import { secureServe } from "../_shared/http.ts";
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character
  );
const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

secureServe("cancel-cod-order", { auth: "staff", roles: ["owner", "admin", "fulfilment"], limit: 20 }, async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in as staff first" }, 401);
    const { orderId, reason, reasonCode, retryEmail } = await request.json();
    if (!/^[a-f0-9-]{36}$/i.test(String(orderId))) return json({ error: "Invalid order" }, 400);
    const explanation = String(reason || "").trim();
    if (!retryEmail && (explanation.length < 10 || explanation.length > 500))
      return json({ error: "Enter a cancellation reason between 10 and 500 characters" }, 400);
    const customerReasons: Record<string, string> = {
      out_of_stock: "the item is no longer available in the selected option",
      quality_issue: "the item did not pass our pre-dispatch quality check",
      unable_to_fulfil: "we are unable to fulfil this order as expected",
      other: "an unexpected fulfilment issue has occurred",
    };
    if (!retryEmail && !customerReasons[String(reasonCode || "other")])
      return json({ error: "Choose a valid cancellation reason" }, 400);

    const rpc = await fetch(`${url}/rest/v1/rpc/${retryEmail ? "authorize_cancellation_email" : "cancel_pending_cod_order"}`, {
      method: "POST",
      headers: { apikey: anon, Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(retryEmail ? { target_order: orderId } : { target_order: orderId, reason: explanation }),
    });
    const result = await rpc.json();
    if (!rpc.ok) return json({ error: result.message || "Order could not be cancelled" }, rpc.status);

    const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const response = await fetch(
      `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`,
      { headers: serviceHeaders },
    );
    if (!response.ok) return json({ ...result, cancelled: true, emailSent: false, emailError: "Order details could not be loaded. Please contact the customer manually." });
    const order = (await response.json())?.[0];
    const savedReasonCode = String(order?.cancellation_reason || "").split(":")[0];
    const customerReason = customerReasons[retryEmail ? savedReasonCode : String(reasonCode)] || customerReasons.other;
    const resend = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("ORDERS_FROM_EMAIL") || Deno.env.get("AUTH_FROM_EMAIL");
    if (!order || !resend || !from) return json({ ...result, cancelled: true, emailSent: false, emailError: "Order email sender is not configured. Contact the customer manually." });

    const rows = order.order_items.map((item: {
      product_name: string; quantity: number; size: string; color: string; unit_price_pence: number;
    }) => `<tr><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(item.product_name)}<br><small>${escapeHtml(item.size)} · ${escapeHtml(item.color)}</small></td><td style="padding:10px;border-bottom:1px solid #ddd">${item.quantity}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">${money(item.unit_price_pence * item.quantity)}</td></tr>`).join("");
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `order-cancelled-${order.id}`,
      },
      body: JSON.stringify({
        from,
        to: [order.customer_email],
        subject: `Update about your Tuxar order ${order.order_number}`,
        html: `<div style="margin:0;background:#f4f4f2;padding:36px 14px;font-family:Arial,sans-serif;color:#111"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #ddd"><div style="background:#111;color:#fff;padding:26px;text-align:center;font-family:Georgia,serif;font-size:28px;letter-spacing:5px">TUXAR</div><div style="padding:34px"><p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#777">Order update</p><h1 style="font-family:Georgia,serif;font-weight:normal">We’re sorry about your order</h1><p>Dear ${escapeHtml(order.customer_name)},</p><p>We regret to let you know that we have had to cancel order <strong>${escapeHtml(order.order_number)}</strong> because ${escapeHtml(customerReason)}. We did not want to send an item that fell short of the Tuxar standard.</p><p>We sincerely apologise for the disappointment and inconvenience this causes.</p><table style="width:100%;border-collapse:collapse;margin:24px 0">${rows}</table><p><strong>Order total:</strong> ${money(order.total_pence)}<br><strong>Payment:</strong> Cash on delivery — no payment has been collected.</p><p>If you would like help finding an alternative, please email <a href="mailto:tuxar.co@gmail.com">tuxar.co@gmail.com</a> and mention your order number. Our team will be pleased to help.</p><p>Thank you for your understanding,<br><strong>The Tuxar Team</strong></p></div></div></div>`,
      }),
    });
    if (!email.ok) {
      const failure = await email.json().catch(() => ({}));
      console.error("Cancellation email failed", email.status, failure);
      const providerMessage = typeof failure?.message === "string" ? failure.message.slice(0, 200) : "Check the sender domain and Resend logs.";
      return json({ ...result, cancelled: true, emailSent: false, emailError: `Email provider rejected the message: ${providerMessage}` });
    }
    await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ cancellation_email_sent_at: new Date().toISOString() }),
    });
    return json({ ...result, cancelled: true, emailSent: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Cancellation failed. Check the Edge Function logs." }, 500);
  }
});
