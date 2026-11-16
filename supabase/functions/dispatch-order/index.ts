import { secureServe } from "../_shared/http.ts";
import { orderDeliveryEstimate } from "../_shared/delivery.ts";
const corsHeaders={"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const money=(p:number,currency="GBP")=>new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(p/100);
secureServe("dispatch-order", { auth: "staff", roles: ["owner", "admin", "fulfilment"], limit: 30 }, async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,authorization=request.headers.get("Authorization")||"";
  if(!authorization)return json({error:"Authentication required"},401);
  const userResponse=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:authorization}});if(!userResponse.ok)return json({error:"Authentication required"},401);const user=await userResponse.json();
  const membershipResponse=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=role`,{headers:{apikey:anon,Authorization:authorization}});const membership=(await membershipResponse.json())?.[0];
  if(!membership||!["owner","admin","fulfilment"].includes(membership.role))return json({error:"Staff permission required"},403);
  const payload=await request.json(),orderId=String(payload.orderId||"");if(!/^[a-f0-9-]{36}$/i.test(orderId))return json({error:"Invalid order"},400);
  const headers={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
  const read=await fetch(`${url}/rest/v1/orders?id=eq.${orderId}&select=*,order_items(*)`,{headers});const order=(await read.json())?.[0];
  if(!order)return json({error:"Order not found"},404);if(order.order_status!=="pending")return json({error:"Only pending orders can be dispatched"},409);
  if(order.payment_method==="stripe"&&order.payment_status!=="paid")return json({error:"Card payment must be received before dispatch"},409);
  const now=new Date().toISOString(),courier=String(payload.courier||order.courier||"").trim().slice(0,100),tracking=String(payload.trackingNumber||"").trim().slice(0,120);
  const fromDate=String(payload.estimatedFrom||order.estimated_delivery_from||""),toDate=String(payload.estimatedTo||order.estimated_delivery_to||"");
  const update=await fetch(`${url}/rest/v1/orders?id=eq.${orderId}&order_status=eq.pending&refund_status=is.null&stripe_refund_id=is.null&payment_status=eq.${order.payment_status}`,{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({order_status:"dispatched",fulfilment_status:"processing",dispatched_at:now,courier:courier||null,tracking_number:tracking||null,estimated_delivery_from:fromDate||null,estimated_delivery_to:toDate||null,updated_at:now})});
  if(!update.ok||(await update.clone().json()).length!==1)return json({error:"Order status changed before dispatch"},409);
  const items=order.order_items.map((item:any)=>`<tr><td style="padding:10px;border-bottom:1px solid #ddd">${esc(item.product_name)}<br><small>${esc(item.sku)} · ${esc(item.size)} · ${esc(item.color)}</small></td><td style="padding:10px;border-bottom:1px solid #ddd">${item.quantity}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">${money(item.unit_price_pence*item.quantity,order.currency||"GBP")}</td></tr>`).join("");
  const resend=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("ORDERS_FROM_EMAIL")||Deno.env.get("AUTH_FROM_EMAIL");if(!resend||!from)return json({error:"Order was dispatched but email delivery is not configured",dispatched:true},503);
  const email=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":`order-dispatched-${order.id}`},body:JSON.stringify({from,to:[order.customer_email],subject:`Your Tuxar order has been dispatched — ${order.order_number}`,html:`<div style="margin:0;background:#f4f4f2;padding:36px 14px;font-family:Arial,sans-serif;color:#111"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #ddd"><div style="background:#111;color:#fff;padding:26px;text-align:center;font-family:Georgia,serif;font-size:28px;letter-spacing:5px">TUXAR</div><div style="padding:34px"><h1 style="font-family:Georgia,serif;font-weight:normal">Your order is on its way</h1><p>Your Tuxar order has been dispatched.</p><p>Overall order timing: ${orderDeliveryEstimate(courier)} Please refer to the current delivery dates below.</p><p><strong>Order:</strong> ${esc(order.order_number)}<br><strong>Courier:</strong> ${esc(courier||"To be confirmed")}<br><strong>Tracking:</strong> ${esc(tracking||"To be confirmed")}<br><strong>Estimated delivery:</strong> ${esc(fromDate)} to ${esc(toDate)}</p><table style="width:100%;border-collapse:collapse">${items}</table><p style="text-align:right"><strong>Total: ${money(order.total_pence,order.currency||"GBP")}</strong></p><p><strong>Delivery address</strong><br>${esc(order.shipping_address_line1)}<br>${esc(order.shipping_city)} ${esc(order.shipping_postal_code)}<br>${esc(order.shipping_country)}</p><p style="color:#666;font-size:13px">Questions? Contact tuxar.co@gmail.com and include your order number.</p></div></div></div>`})});
  if(!email.ok)return json({error:"Order was dispatched but the email could not be sent",dispatched:true},502);
  await fetch(`${url}/rest/v1/orders?id=eq.${orderId}`,{method:"PATCH",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({dispatch_email_sent_at:now})});
  return json({dispatched:true,emailSent:true});
 }catch(error){console.error(error);return json({error:"Unable to dispatch order"},400);}
});
