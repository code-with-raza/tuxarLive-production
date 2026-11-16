import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import { requestCustomerOtp } from "@/lib/customer-verification";
import type { Locale } from "@/i18n/i18n";

export const Route = createFileRoute("/$locale/verify-email")({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  head: () => ({ meta: [{ title: "Verify your email — Tuxar" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { returnTo } = Route.useSearch();
  const { user, isLoading, refetch, logout } = useUser();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const issued = useRef<string | null>(null);
  const destination = returnTo?.startsWith(`/${locale}/`) ? returnTo : `/${locale}/account`;

  const send = useCallback(async () => {
    setSending(true); setError("");
    const { data, error: requestError } = await requestCustomerOtp(supabase);
    setSending(false);
    if (requestError || data?.error) { setError(data?.error || requestError?.message || "Could not send the verification code."); return; }
    if (data?.verified) { await refetch(); sessionStorage.removeItem("tuxar-auth-return-to"); navigate({ to: destination, replace: true }); return; }
    setSeconds(60); toast.success("A verification code has been sent.");
  }, [refetch, navigate, destination]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: `/${locale}/login`, search: { returnTo: destination }, replace: true }); return; }
    if (user.tuxarVerified) { sessionStorage.removeItem("tuxar-auth-return-to"); navigate({ to: destination, replace: true }); return; }
    if (issued.current !== user.id) { issued.current = user.id; void send(); }
  }, [isLoading, user, destination, locale, navigate, send]);

  useEffect(() => { if (seconds <= 0) return; const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [seconds]);

  if (isLoading || !user) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;

  return <main className="container-luxe flex min-h-[65vh] items-center justify-center py-20"><div className="w-full max-w-md text-center"><MailCheck className="mx-auto mb-5 h-10 w-10" strokeWidth={1.3}/><p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Compulsory account verification</p><h1 className="mt-2 font-display text-4xl">Verify your email</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Enter the six-digit Tuxar code sent to <strong>{maskEmail(user.email)}</strong>.</p>{error && <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/10 p-4 text-left text-sm text-destructive">{error}</div>}<form className="mt-8" onSubmit={async(event)=>{event.preventDefault();if(!/^\d{6}$/.test(code)){setError("Enter the complete six-digit code.");return;}setBusy(true);setError("");const {data,error:verifyError}=await supabase.functions.invoke("verify-customer-otp",{body:{code}});if(verifyError||data?.error){setError(data?.error||verifyError?.message||"Verification failed.");setBusy(false);return;}await refetch();toast.success("Your Tuxar account is verified.");navigate({to:destination,replace:true});}}><label className="block text-left text-xs uppercase tracking-widest">Verification code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="mt-2 h-16 w-full border bg-background px-4 text-center font-mono text-2xl tracking-[0.45em] outline-none focus:border-foreground"/></label><button disabled={busy||code.length!==6} className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-foreground text-xs uppercase tracking-widest text-background disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>} Verify account</button></form><button disabled={sending||seconds>0} onClick={()=>void send()} className="mt-6 text-sm underline underline-offset-4 disabled:opacity-50">{sending?"Sending…":seconds>0?`Send another code in ${seconds}s`:"Send a new code"}</button><button onClick={()=>void logout()} className="mt-5 block w-full text-xs text-muted-foreground underline underline-offset-4">Use a different account</button></div></main>;
}

function maskEmail(email:string){const [name,domain]=email.split("@");return `${name.slice(0,1)}${"•".repeat(Math.max(3,name.length-1))}@${domain}`;}
