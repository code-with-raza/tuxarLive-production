import { secureServe } from "../_shared/http.ts";
const cors={"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");}
secureServe("resend-email-registration", { auth: "public", limit: 10, emailLimit: 5, windowSeconds: 3600 }, async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const {email}=await request.json(),normalized=String(email||"").trim().toLowerCase();
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,pepper=Deno.env.get("OTP_PEPPER")!,resend=Deno.env.get("RESEND_API_KEY")!,from=Deno.env.get("AUTH_FROM_EMAIL")!;
  if(!url||!service||!pepper||!resend||!from)return json({error:"Verification service is not configured"},503);
  const headers={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
  const profiles=await fetch(`${url}/rest/v1/customer_profiles?email=eq.${encodeURIComponent(normalized)}&tuxar_verified=eq.false&account_status=eq.pending&select=user_id,first_name&limit=1`,{headers});
  if(!profiles.ok)return json({error:"Verification is temporarily unavailable"},503);
  const profile=(await profiles.json())?.[0];
  if(!profile)return json({sent:true});
  const recentResponse=await fetch(`${url}/rest/v1/customer_otp_challenges?user_id=eq.${profile.user_id}&select=created_at&order=created_at.desc&limit=1`,{headers});
  const recent=(await recentResponse.json())?.[0];
  if(recent&&Date.now()-new Date(recent.created_at).getTime()<60000)return json({error:"Please wait 60 seconds before requesting another code"},429);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0"),codeHash=await sha256(`${profile.user_id}:${code}:${pepper}`);
  const challenge=await fetch(`${url}/rest/v1/customer_otp_challenges`,{method:"POST",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({user_id:profile.user_id,code_hash:codeHash,expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
  if(!challenge.ok)return json({error:"A verification challenge could not be saved"},503);
  const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":`registration-resend-${profile.user_id}-${codeHash.slice(0,12)}`},body:JSON.stringify({from,to:[normalized],subject:`${code} is your new Tuxar verification code`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:40px"><h1 style="font-family:Georgia,serif">Verify your Tuxar account</h1><p>Enter this new code to finish creating your account:</p><div style="background:#111;color:#fff;text-align:center;padding:22px;font-size:32px;font-weight:bold;letter-spacing:12px">${code}</div><p style="color:#666">This code expires in 10 minutes and can only be used once.</p></div>`})});
  if(!mail.ok){console.error("Verification mail provider rejected the request",mail.status);return json({error:"A new verification email could not be sent"},502);}
  return json({sent:true});
 }catch(error){console.error(error);return json({error:"A new verification code could not be sent"},400);}
});
