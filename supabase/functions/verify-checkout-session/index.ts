import { secureServe } from "../_shared/http.ts";
import { paymentMatches } from "../_shared/currency.ts";
const cors={"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
secureServe("verify-checkout-session", { auth: "user", limit: 60 }, async(request, context)=>{
  if(request.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(request.method!=="POST") return reply({error:"Method not allowed"},405);
  try {
    const {sessionId}=await request.json();
    if(!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(String(sessionId||""))) return reply({error:"Invalid checkout reference"},400);
    const key=Deno.env.get("STRIPE_SECRET_KEY"); if(!key) return reply({error:"Payment verification is not configured"},503);
    const databaseUrl=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!databaseUrl||!service)return reply({error:"Verification is not configured"},503);
    const owned=await fetch(`${databaseUrl}/rest/v1/orders?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${context.user!.id}&select=id,total_pence,currency`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
    if(!owned.ok)return reply({error:"Unable to verify order ownership"},503);
    const ownedOrder=(await owned.json())?.[0];
    if(!ownedOrder)return reply({error:"Order not found"},404);
    const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`,{headers:{Authorization:`Bearer ${key}`}});
    const session=await response.json(); if(!response.ok) return reply({error:"Unable to verify payment"},502);
    const verified=session.status==="complete"&&paymentMatches(ownedOrder,session);
    let analytics;
    const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(verified&&session.client_reference_id&&supabaseUrl&&serviceRoleKey){
      const headers={apikey:serviceRoleKey,Authorization:`Bearer ${serviceRoleKey}`};
      const orderResponse=await fetch(`${supabaseUrl}/rest/v1/orders?user_id=eq.${context.user!.id}&stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&order_number=eq.${encodeURIComponent(session.client_reference_id)}&select=order_number,subtotal_pence,shipping_pence,discount_pence,coupon_code,order_items(product_name,product_slug,sku,size,color,quantity,unit_price_pence)`,{headers});
      const orders=orderResponse.ok?await orderResponse.json():[];
      const order=orders?.[0];
      if(order)analytics={
        transaction_id:order.order_number,
        value:Math.max(0,Number(order.subtotal_pence||0)-Number(order.discount_pence||0))/100,
        currency:ownedOrder.currency,
        shipping:Number(order.shipping_pence||0)/100,
        ...(order.coupon_code?{coupon:order.coupon_code}:{}),
        ...(Number(order.discount_pence||0)>0?{discount:Number(order.discount_pence)/100}:{}),
        items:(order.order_items||[]).map((item:any)=>({item_id:item.sku||item.product_slug,item_name:item.product_name,...(item.size||item.color?{item_variant:[item.size,item.color].filter(Boolean).join(" / ")}:{}),price:Number(item.unit_price_pence||0)/100,quantity:Number(item.quantity||1)})),
      };
    }
    return reply({verified,orderNumber:session.client_reference_id||session.id,analytics});
  } catch { return reply({error:"Unable to verify payment"},400); }
});
