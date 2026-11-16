import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export function AdminMfaGate({ children, logout, rechecking = false }: { children: ReactNode; logout: () => Promise<void>; rechecking?: boolean }) {
  const [ready, setReady] = useState(false);
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    if (rechecking) return;
    setReady(false);
    let active = true;
    void (async () => {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (!active) return;
      if (assurance.data.currentLevel === "aal2") { setReady(true); setGranted(true); return; }
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      if (active) setFactorId(factors.data.totp.find((factor) => factor.status === "verified")?.id ?? null);
    })().catch(() => { if (active) setError("Two-factor status could not be checked. Please sign in again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rechecking]);
  // Keep the workspace mounted during revalidation, but hide it until role/MFA checks pass.
  const protectedContent = granted && <div hidden={loading || rechecking || !ready} inert={loading || rechecking || !ready}>{children}</div>;
  if (loading || rechecking) return <>{protectedContent}<main className="container-luxe py-24 text-center">Checking staff authentication…</main></>;
  if (ready) return <>{protectedContent}</>;

  const enroll = async () => {
    setBusy(true); setError("");
    try {
      // Replacing unfinished enrollment is part of restarting the user's setup.
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      if (verified) { setFactorId(verified.id); return; }
      for (const factor of factors.data.all.filter((entry) => entry.factor_type === "totp" && entry.status === "unverified")) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw removed.error;
      }
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Tuxar staff" });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      const qr = result.data.totp.qr_code;
      setEnrollment({ qr: qr.startsWith("data:") ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`, secret: result.data.totp.secret });
    } catch { setError("Authenticator setup failed. Please try again."); }
    finally { setBusy(false); }
  };
  return (
    <>{protectedContent}<main className="container-luxe max-w-lg py-20 text-center">
      <h1 className="font-display text-3xl">Staff two-factor authentication</h1>
      <p className="mt-4 text-sm text-muted-foreground">Use an authenticator app to protect access to orders and store settings.</p>
      {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
      {!factorId ? <button type="button" disabled={busy} onClick={() => void enroll()} className="mt-6 border px-6 py-3">Set up authenticator</button> : (
        <form className="mt-6 space-y-4" onSubmit={async (event) => {
          event.preventDefault(); if (!/^\d{6}$/.test(code)) return;
          setBusy(true); setError("");
          try {
            const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
            if (result.error) throw result.error;
            const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (level.error || level.data.currentLevel !== "aal2") throw new Error("Verification incomplete");
            setEnrollment(null); setCode(""); setReady(true);
          } catch { setCode(""); setError("The authenticator code could not be verified. Please try again."); }
          finally { setBusy(false); }
        }}>
          {enrollment && <div className="space-y-3"><img className="mx-auto h-52 w-52" src={enrollment.qr} alt="Scan this code with your authenticator app" /><p className="text-xs">Manual setup key: <code className="break-all">{enrollment.secret}</code></p></div>}
          <label className="block text-left text-sm">Authenticator code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-12 w-full border bg-background px-4 text-center font-mono text-xl tracking-widest" /></label>
          <button disabled={busy || code.length !== 6} className="w-full bg-foreground px-6 py-3 text-background disabled:opacity-50">Verify and continue</button>
        </form>
      )}
      <button type="button" onClick={() => void logout()} className="mt-6 text-sm underline">Sign out</button>
    </main></>
  );
}
