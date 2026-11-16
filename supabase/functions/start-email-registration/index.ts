import { secureServe } from "../_shared/http.ts";
const cors={"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");}

secureServe("start-email-registration", { auth: "public", limit: 10, emailLimit: 3, windowSeconds: 3600 }, async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  let createdUserId="";
  try{
    const {email,password,firstName,lastName}=await request.json();
    const normalized=String(email||"").trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(normalized))return json({error:"Enter a valid email address"},400);
    if(typeof password!=="string"||password.length<8||new TextEncoder().encode(password).length>72||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return json({error:"Password does not meet the security requirements"},400);
    if(typeof firstName!=="string"||typeof lastName!=="string"||!firstName.trim()||!lastName.trim()||firstName.length>100||lastName.length>100)return json({error:"Enter valid first and last names"},400);
    const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,pepper=Deno.env.get("OTP_PEPPER")!,resend=Deno.env.get("RESEND_API_KEY")!,from=Deno.env.get("AUTH_FROM_EMAIL")!;
    if(!url||!service||!pepper||!resend||!from)return json({error:"Registration service is not configured"},503);
    const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
    const create=await fetch(`${url}/auth/v1/admin/users`,{method:"POST",headers:adminHeaders,body:JSON.stringify({email:normalized,password,email_confirm:true,ban_duration:"876000h",user_metadata:{first_name:String(firstName||"").trim(),last_name:String(lastName||"").trim(),full_name:`${String(firstName||"").trim()} ${String(lastName||"").trim()}`.trim()}})});
    const created=await create.json();
    if(!create.ok){
      const message=String(created?.msg||created?.message||created?.error||"");
      if(/already|registered|exists/i.test(message))return json({sent:true});
      console.error("Auth user creation failed",create.status,message);
      return json({error:"Account registration could not be started"},create.status>=500?502:400);
    }
    createdUserId=created.id;
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
    const codeHash=await sha256(`${createdUserId}:${code}:${pepper}`);
    const challenge=await fetch(`${url}/rest/v1/customer_otp_challenges`,{method:"POST",headers:{...adminHeaders,Prefer:"return=minimal"},body:JSON.stringify({user_id:createdUserId,code_hash:codeHash,expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
    if(!challenge.ok)throw new Error("Could not create verification challenge");
    const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":`registration-${createdUserId}-${codeHash.slice(0,12)}`},body:JSON.stringify({from,to:[normalized],subject:`${code} is your Tuxar verification code`,html:`<div style="margin:0;background:#f4f4f2;padding:40px 16px;font-family:Arial,sans-serif;color:#111"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ddd"><div style="padding:30px;text-align:center;border-bottom:1px solid #e5e5e2"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:6px">TUXAR</div><div style="margin-top:8px;font-size:10px;letter-spacing:3px;color:#666">LEATHER · HONESTLY MADE</div></div><div style="padding:42px 36px"><p style="font-size:11px;letter-spacing:2px;color:#666">ACCOUNT VERIFICATION</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:normal">Verify your email address</h1><p>Hello ${escapeHtml(String(firstName||""))}, enter this code on Tuxar to finish creating your account.</p><div style="background:#111;color:#fff;text-align:center;padding:22px;font-size:32px;font-weight:bold;letter-spacing:12px">${code}</div><p style="margin-top:24px;color:#666;font-size:13px;line-height:1.6">This code expires in 10 minutes and can only be used once. Never share it with anyone.</p></div></div></div>`})});
    if(!mail.ok){console.error("Resend failed",mail.status,await mail.text());throw new Error("Verification email could not be sent");}
    return json({sent:true});
  }catch(error){
    console.error(error);
    if(createdUserId){const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;await fetch(`${url}/auth/v1/admin/users/${createdUserId}`,{method:"DELETE",headers:{apikey:service,Authorization:`Bearer ${service}`}}).catch(()=>{});}
    return json({error:"Verification email could not be sent. Please try again."},502);
  }
});
