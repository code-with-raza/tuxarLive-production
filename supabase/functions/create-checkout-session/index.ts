import { secureServe, HttpError } from "../_shared/http.ts";
import { verifyUsdQuote } from "../_shared/usd-quote.ts";
import { usdMinor } from "../_shared/usd-money.ts";
import { estimatedDeliveryWindow, getDeliveryOption, getDeliveryCountry, DELIVERY_COUNTRIES } from "../_shared/delivery.ts";
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { isCurrency, currencyForCountry } from "../_shared/currency.ts";

type CatalogItem = { name: string; unitAmount: number };
type CheckoutItem = { slug: string; size?: string; color?: string; qty: number };


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

secureServe("create-checkout-session", { auth: "user", limit: 10, windowSeconds: 600 }, async (request, context) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const siteUrl = (Deno.env.get("SITE_URL") || "https://tuxar.co.uk").replace(/\/$/, "");
    if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
      return json({ error: "Secure checkout is not configured" }, 503);
    }

    const payload = await request.json();
    const locale = ["en", "de", "fr", "it", "es"].includes(payload.locale)
      ? payload.locale
      : "en";
    const items = (Array.isArray(payload.items) ? payload.items : []) as CheckoutItem[];
    if (!items.length || items.length > 20) return json({ error: "Invalid cart" }, 400);

    const customer = payload.customer ?? {};
    const text = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
    const customerName = text(customer.customerName, 100);
    const customerEmail = context.user?.email?.trim().toLowerCase() || "";
    const customerPhone = text(customer.customerPhone, 40);
    const streetAddress = text(customer.streetAddress, 200);
    const city = text(customer.city, 100);
    const postalCode = text(customer.postalCode, 20);
    const destination = getDeliveryCountry(customer.country);
    const country = destination?.name || "";
    // Old cached clients remain compatible, but no delivery surcharge is charged.
    const deliveryOption = getDeliveryOption(customer.shippingMethod === "STANDARD" ? "UPS" : customer.shippingMethod === "EXPRESS" ? "DPD" : customer.shippingMethod);
    if (!deliveryOption) return json({ error: "Select UPS, DHL or DPD Geopost delivery" }, 400);
    if (!destination) return json({ error: "Delivery is available to the United Kingdom, Germany, Spain, France and Italy" }, 400);
    const shippingMethod = "STANDARD";
    if (payload.currency !== undefined && !isCurrency(payload.currency)) return json({error:"Unsupported payment currency"},400);
    const currency = payload.currency ?? currencyForCountry(country);
    const usdQuote = currency === "USD" ? await verifyUsdQuote(payload.usdQuoteToken, serviceRoleKey) : null;
    if (usdQuote && usdQuote.expiresAt - Date.now() < 35 * 60000) return json({ error: "Refresh USD pricing before opening secure payment." }, 409);
    if (!customerName || !customerEmail.includes("@") || !customerPhone || !streetAddress || !city || !postalCode || !country) {
      return json({ error: "Complete shipping details are required" }, 400);
    }

    const databaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    const validatedItems = await Promise.all(items.map(async (item) => {
      const quantity = Number(item.qty);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new Error("Cart contains an invalid product or quantity");
      }
      const query = new URLSearchParams({ slug: `eq.${String(item.slug || "")}`, status: "eq.active", select: "name,price_pence,product_variants!inner(sku,size,color,stock,active,price_pence)" });
      query.set("product_variants.size", `eq.${text(item.size, 30)}`); query.set("product_variants.color", `eq.${text(item.color, 50)}`); query.set("product_variants.active", "eq.true");
      const response = await fetch(`${supabaseUrl}/rest/v1/products?${query}`, { headers: databaseHeaders });
      const rows = await response.json(); const row = rows?.[0]; const variant = row?.product_variants?.[0];
      if (!response.ok || !row || !variant || variant.stock < quantity) throw new Error(`${item.size || "Selected"} ${item.color || "variant"} is no longer available`);
      const baseUnitAmount = variant.price_pence ?? row.price_pence;
      const product: CatalogItem = { name: row.name, unitAmount: usdQuote ? usdMinor(baseUnitAmount, usdQuote.rateE8) : baseUnitAmount };
      return { item, product, quantity, sku: variant.sku, baseUnitAmount };
    }));
    const subtotalPence = validatedItems.reduce((sum, row) => sum + row.product.unitAmount * row.quantity, 0);
    const shippingPence = usdQuote ? usdMinor(deliveryOption.pricePence, usdQuote.rateE8) : deliveryOption.pricePence;
    const baseSubtotalPence = validatedItems.reduce((sum, row) => sum + row.baseUnitAmount * row.quantity, 0);
    const orderNumber = `TX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const userId = context.user?.id;
    if (!userId) return json({ error: "Sign in with a verified Tuxar account to continue" }, 401);
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/customer_profiles?user_id=eq.${userId}&tuxar_verified=eq.true&account_status=eq.active&select=user_id`, { headers: databaseHeaders });
    const verifiedProfile = await profileResponse.json();
    if (!profileResponse.ok || !verifiedProfile?.length) return json({ error: "Complete Tuxar email verification before checkout" }, 403);

    let usdDiscount = 0;
    if (usdQuote) {
      if (payload.couponCode) {
        const previewResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/preview_usd_coupon`, {
          method: "POST", headers: databaseHeaders,
          body: JSON.stringify({ supplied_code: payload.couponCode, base_subtotal_pence: baseSubtotalPence, usd_subtotal_cents: subtotalPence, rate_e8: usdQuote.rateE8 }),
        });
        const preview = await previewResponse.json();
        if (!previewResponse.ok) return json({ error: preview.message || "Coupon could not be applied" }, 400);
        usdDiscount = preview.discountPence;
        if (!Number.isSafeInteger(usdDiscount) || usdDiscount < 0 || usdDiscount > subtotalPence) throw new Error("Invalid discount");
      }
      // Detect stale catalogue prices, manipulated display rates and rounding mismatches before reserving an order.
      if (!Number.isSafeInteger(payload.expectedTotalMinor) || payload.expectedTotalMinor !== subtotalPence + shippingPence - usdDiscount) {
        return json({ error: "Your USD total changed. Refresh your bag and review the updated prices before paying." }, 409);
      }
    }

    const delivery = estimatedDeliveryWindow(new Date(), deliveryOption.maxDays);
    const orderResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: databaseHeaders,
      body: JSON.stringify({
        order_number: orderNumber,
        user_id: userId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        shipping_address_line1: streetAddress,
        shipping_city: city,
        shipping_postal_code: postalCode,
        shipping_country: country,
        currency,
        ...(usdQuote ? { usd_rate_e8: usdQuote.rateE8, usd_rate_date: usdQuote.date, base_subtotal_pence: baseSubtotalPence } : {}),
        shipping_method: shippingMethod,
        courier: deliveryOption.name,
        subtotal_pence: subtotalPence,
        shipping_pence: shippingPence,
        total_pence: subtotalPence + shippingPence,
        payment_method: "stripe",
        order_status: "pending",
        idempotency_key: crypto.randomUUID(),
        estimated_delivery_from: delivery.from,
        estimated_delivery_to: delivery.to,
      }),
    });
    const createdOrders = await orderResponse.json();
    if (!orderResponse.ok || !createdOrders?.[0]?.id) throw new Error("Unable to reserve order");
    const orderId = createdOrders[0].id;
    let stripeCouponId: string | null = null;
    if (payload.couponCode) {
      const couponResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/redeem_order_coupon_for_user`, { method:"POST", headers:databaseHeaders, body:JSON.stringify({target_order:orderId,supplied_code:payload.couponCode,customer_user:context.user!.id}) });
      const coupon = await couponResponse.json();
      if (!couponResponse.ok) return json({error:coupon.message||"Coupon could not be applied"},400);
      if (usdQuote && coupon.discountPence !== usdDiscount) return json({ error: "Your discount changed. Review your USD total before paying." }, 409);
      const couponParams=new URLSearchParams({duration:"once",amount_off:String(coupon.discountPence),currency:currency.toLowerCase(),name:`Tuxar ${coupon.code}`});
      const stripeCouponResponse=await fetch("https://api.stripe.com/v1/coupons",{method:"POST",headers:{Authorization:`Bearer ${stripeSecret}`,"Content-Type":"application/x-www-form-urlencoded"},body:couponParams});
      const stripeCoupon=await stripeCouponResponse.json();
      if(!stripeCouponResponse.ok)return json({error:"Payment discount could not be applied"},502);
      stripeCouponId=stripeCoupon.id;
    }

    const itemsResponse = await fetch(`${supabaseUrl}/rest/v1/order_items`, {
      method: "POST",
      headers: { ...databaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(validatedItems.map(({ item, product, quantity, sku }) => ({
        order_id: orderId,
        product_slug: item.slug,
        product_name: product.name,
        sku,
        size: text(item.size, 30) || null,
        color: text(item.color, 50) || null,
        quantity,
        unit_price_pence: product.unitAmount,
      }))),
    });
    if (!itemsResponse.ok) throw new Error("Unable to reserve order items");

    const params = new URLSearchParams();
    params.set("mode", "payment");
    // GBP/EUR retain fixed prices; USD uses the server-verified quote above.
    params.set("adaptive_pricing[enabled]", "false");
    if (usdQuote) params.set("expires_at", String(Math.floor(usdQuote.expiresAt / 1000)));
    params.set("locale", locale);
    params.set("customer_email", customerEmail);
    params.set("client_reference_id", orderNumber);
    params.set("success_url", `${siteUrl}/${locale}/confirmation?orderNumber={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${siteUrl}/${locale}/checkout`);
    params.set("billing_address_collection", "required");
    DELIVERY_COUNTRIES.forEach((destination, index) => params.set(`shipping_address_collection[allowed_countries][${index}]`, destination.code));
    params.set("phone_number_collection[enabled]", "true");
    params.set("metadata[order_id]", orderId);
    params.set("metadata[delivery_carrier]", deliveryOption.name);
    params.set("metadata[currency]", currency);
    params.set("metadata[order_number]", orderNumber);
    if(stripeCouponId)params.set("discounts[0][coupon]",stripeCouponId);

    validatedItems.forEach(({ item, product, quantity }, index: number) => {
      const detail = [item.size && `Size: ${item.size}`, item.color && `Colour: ${item.color}`]
        .filter(Boolean)
        .join(" · ");
      params.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
      params.set(`line_items[${index}][price_data][unit_amount]`, String(product.unitAmount));
      params.set(`line_items[${index}][price_data][product_data][name]`, product.name);
      if (detail) params.set(`line_items[${index}][price_data][product_data][description]`, detail);
      params.set(`line_items[${index}][quantity]`, String(quantity));
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Stripe-Version": "2024-11-20.acacia",
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) return json({ error: "Payment checkout could not be started" }, 502);

    const savedSession = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}`, {
      method: "PATCH",
      headers: { ...databaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }),
    });
    if (!savedSession.ok) {
      // Do not direct a customer to a session whose payment cannot be reconciled.
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}/expire`, {
        method: "POST", headers: { Authorization: `Bearer ${stripeSecret}` },
      }).catch(() => undefined);
      return json({ error: "Payment checkout could not be started. Please try again later" }, 502);
    }

    return json({ id: session.id, url: session.url, orderNumber });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Checkout failed" }, error instanceof HttpError ? error.status : 400);
  }
});
