import { secureServe } from "../_shared/http.ts";
const corsHeaders={"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");}
secureServe("issue-customer-otp", { auth: "user", limit: 5, windowSeconds: 600 }, async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,pepper=Deno.env.get("OTP_PEPPER")!,resend=Deno.env.get("RESEND_API_KEY")!,from=Deno.env.get("AUTH_FROM_EMAIL")!;
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization||!pepper||!resend||!from)return json({error:"Verification service is not configured"},503);
  const userResponse=await fetch(`${url}/auth/v1/user`,{headers:{Authorization:authorization,apikey:service}});
  if(!userResponse.ok)return json({error:"Authentication required"},401);
  const user=await userResponse.json();
  const dbHeaders={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
  const profileResponse=await fetch(`${url}/rest/v1/customer_profiles?user_id=eq.${user.id}&select=tuxar_verified,registration_method`,{headers:dbHeaders});
  const profile=(await profileResponse.json())?.[0];
  if(profile?.tuxar_verified)return json({verified:true});
  if(profile?.registration_method!=="google")return json({error:"Use the signup verification code sent by Supabase"},400);
  const recentResponse=await fetch(`${url}/rest/v1/customer_otp_challenges?user_id=eq.${user.id}&select=created_at&order=created_at.desc&limit=1`,{headers:dbHeaders});
  const recent=(await recentResponse.json())?.[0];
  if(recent&&Date.now()-new Date(recent.created_at).getTime()<60000)return json({error:"Please wait before requesting another code"},429);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
  const codeHash=await sha256(`${user.id}:${code}:${pepper}`);
  const challenge=await fetch(`${url}/rest/v1/customer_otp_challenges`,{method:"POST",headers:{...dbHeaders,Prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,code_hash:codeHash,expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
  if(!challenge.ok)return json({error:"A verification challenge could not be saved"},503);
  const emailResponse=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":`customer-otp-${user.id}-${codeHash.slice(0,12)}`},body:JSON.stringify({from,to:[user.email],subject:`${code} is your Tuxar verification code`,html:`<div style="margin:0;background:#f4f4f2;padding:40px 16px;font-family:Arial,sans-serif;color:#111"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ddd"><div style="padding:30px;text-align:center;border-bottom:1px solid #e5e5e2"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:6px">TUXAR</div><div style="margin-top:8px;font-size:10px;letter-spacing:3px;color:#666">LEATHER · HONESTLY MADE</div></div><div style="padding:42px 36px"><p style="font-size:11px;letter-spacing:2px;color:#666">ACCOUNT VERIFICATION</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:normal">Verify your email address</h1><p>Hello ${escapeHtml(user.user_metadata?.first_name||user.user_metadata?.given_name||"")}, enter this code on Tuxar to activate your account.</p><div style="background:#111;color:#fff;text-align:center;padding:22px;font-size:32px;font-weight:bold;letter-spacing:12px">${code}</div><p style="margin-top:24px;color:#666;font-size:13px;line-height:1.6">This code expires in 10 minutes and can only be used once. Never share it with anyone.</p></div></div></div>`})});
  if(!emailResponse.ok)return json({error:"Verification email could not be sent"},502);
  return json({sent:true});
 }catch(error){console.error(error);return json({error:"Verification request failed"},400);}
});
