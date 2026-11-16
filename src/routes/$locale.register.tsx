import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";

export const Route = createFileRoute("/$locale/register")({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    return {
      meta: [
        {
          title: `${locale === "it" ? "Crea un account" : locale === "de" ? "Konto erstellen" : locale === "fr" ? "Créer un compte" : locale === "es" ? "Crear una cuenta" : "Create an account"} — Tuxar`,
        },
        {
          name: "description",
          content: "Create your secure Tuxar customer account to manage orders and saved pieces.",
        },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  component: Register,
});

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(60),
    lastName: z.string().trim().min(1, "Last name is required").max(60),
    email: z.string().trim().email("Enter a valid email address").max(255),
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(72)
      .regex(/[A-Z]/, "Password must contain a capital letter")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFields = z.infer<typeof registerSchema>;

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== "{}") return error.message;
  if (typeof error === "string" && error.trim() && error.trim() !== "{}") return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error_description?: unknown; error?: unknown };
    for (const value of [candidate.message, candidate.error_description, candidate.error]) {
      if (typeof value === "string" && value.trim() && value.trim() !== "{}") return value;
    }
  }
  return fallback;
}

async function functionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const payload = await context.clone().json() as { error?: string; message?: string };
      if (payload.error || payload.message) return payload.error || payload.message || fallback;
    } catch {
      // Fall through to the normalised client error below.
    }
  }
  return readableError(error, fallback);
}

function Register() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isLoading, loginWithGoogle, registerWithEmail, verifySignupOtp, resendSignupOtp } = useUser();
  const [googlePending, setGooglePending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPending, setOtpPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const loginLink = getLocalizedLink("/login", locale);
  const privacyLink = getLocalizedLink("/privacy-policy", locale);
  const termsLink = getLocalizedLink("/terms-conditions", locale);
  const safeReturnTo = returnTo?.startsWith(`/${locale}/`) ? returnTo : getLocalizedLink("/account", locale).to;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({ resolver: zodResolver(registerSchema) });
  const passwordValue = watch("password", "");

  useEffect(() => {
    if (!isLoading && user?.tuxarVerified) {
      navigate({ to: safeReturnTo, replace: true });
    } else if (!isLoading && user && user.registrationMethod === "google") {
      navigate({ to: `/${locale}/verify-email`, search: { returnTo: safeReturnTo }, replace: true });
    }
  }, [user, isLoading, locale, navigate, safeReturnTo]);

  const submitEmailRegistration = async (values: RegisterFields) => {
    setServerError(null);
    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      const result = await registerWithEmail({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        redirectTo: `${window.location.origin}${safeReturnTo}`,
      });
      if (result.needsEmailConfirmation) {
        setConfirmationPassword(values.password);
        setConfirmationEmail(values.email.trim());
      }
      else {
        navigate({ to: safeReturnTo, replace: true });
      }
    } catch (error) {
      setServerError(readableError(error, "Account creation failed. Please try again. If the problem continues, contact Tuxar support."));
    }
  };

  const handleGoogle = async () => {
    setServerError(null);
    setGooglePending(true);
    try {
      sessionStorage.setItem("tuxar-auth-return-to", safeReturnTo);
      const callback = new URL(`/${locale}/account`, window.location.origin);
      await loginWithGoogle(callback.toString());
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Google sign-up failed.");
      setGooglePending(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (confirmationEmail) {
    return (
      <div className="container-luxe flex min-h-[60vh] items-center justify-center py-24">
        <div className="w-full max-w-md text-center">
          <MailCheck className="mx-auto mb-5 h-10 w-10" strokeWidth={1.3} />
          <h1 className="font-display text-4xl">Verify your email</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Enter the six-digit verification code sent to <strong>{confirmationEmail}</strong>.
          </p>
          {serverError && <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/10 p-4 text-left text-sm text-destructive">{serverError}</div>}
          <form className="mt-8" onSubmit={async (event) => {
            event.preventDefault();
            if (!/^\d{6}$/.test(otp)) { setServerError("Enter the complete six-digit code."); return; }
            setOtpPending(true); setServerError(null);
            try {
              await verifySignupOtp(confirmationEmail, otp, confirmationPassword);
              navigate({ to: safeReturnTo, replace: true });
            } catch (error) {
              setServerError(error instanceof Error ? error.message : "Verification failed.");
            } finally { setOtpPending(false); }
          }}>
            <label className="block text-left text-xs uppercase tracking-widest">Verification code
              <input autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-16 w-full border border-border bg-background px-4 text-center font-mono text-2xl tracking-[0.45em] outline-none focus:border-foreground" />
            </label>
            <button disabled={otpPending || otp.length !== 6} className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-foreground text-xs uppercase tracking-widest text-background disabled:opacity-50">{otpPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify account</button>
          </form>
          <button disabled={resendPending} onClick={async () => {
            setResendPending(true); setServerError(null);
            try { await resendSignupOtp(confirmationEmail); toast.success("A new verification code has been sent."); }
            catch (error) { setServerError(error instanceof Error ? error.message : "Could not resend the code."); }
            finally { setResendPending(false); }
          }} className="mt-6 text-sm underline underline-offset-4 disabled:opacity-50">{resendPending ? "Sending…" : "Send a new code"}</button>
        </div>
      </div>
    );
  }

  const fieldClass =
    "h-11 w-full border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground";

  return (
    <div className="container-luxe py-20 md:py-28 flex justify-center">
      <div className="w-full max-w-[460px] animate-luxe-fade-up">
        <h1 className="font-display text-4xl mb-2 text-center md:text-left">Create an account</h1>
        <p className="text-muted-foreground mb-8 text-center md:text-left text-sm tracking-wide">
          Save your details securely and manage your Tuxar account.
        </p>

        {serverError && (
          <div role="alert" className="p-4 mb-6 bg-destructive/10 text-destructive text-sm border-l-2 border-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(submitEmailRegistration)} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <AuthField label="First name" error={errors.firstName?.message}>
              <input autoComplete="given-name" {...register("firstName")} className={fieldClass} />
            </AuthField>
            <AuthField label="Last name" error={errors.lastName?.message}>
              <input autoComplete="family-name" {...register("lastName")} className={fieldClass} />
            </AuthField>
          </div>
          <AuthField label="Email address" error={errors.email?.message}>
            <input type="email" autoComplete="email" {...register("email")} className={fieldClass} />
          </AuthField>
          <AuthField label="Password" error={errors.password?.message}>
            <input type="password" autoComplete="new-password" {...register("password")} className={fieldClass} />
            <PasswordRules password={passwordValue} />
          </AuthField>
          <AuthField label="Confirm password" error={errors.confirmPassword?.message}>
            <input type="password" autoComplete="new-password" {...register("confirmPassword")} className={fieldClass} />
          </AuthField>

          <button
            type="submit"
            disabled={isSubmitting || googlePending}
            className="flex h-12 w-full items-center justify-center gap-2 bg-foreground text-sm font-medium uppercase tracking-widest text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>

        <div className="relative flex items-center gap-4 py-7">
          <div className="flex-1 border-t border-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googlePending || isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-3 border border-border bg-background text-sm font-medium uppercase tracking-widest transition hover:bg-section disabled:opacity-50"
        >
          {googlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Sign up with Google
        </button>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link to={termsLink.to} params={termsLink.params} className="underline">Terms</Link> and{" "}
          <Link to={privacyLink.to} params={privacyLink.params} className="underline">Privacy Policy</Link>.
        </p>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to={loginLink.to} params={loginLink.params} className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function PasswordRules({ password }: { password: string }) {
  const rules = [
    [password.length >= 8, "At least 8 characters"],
    [/[A-Z]/.test(password), "One capital letter"],
    [/[0-9]/.test(password), "One number"],
    [/[^A-Za-z0-9]/.test(password), "One special character"],
  ] as const;

  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 normal-case tracking-normal text-muted-foreground sm:grid-cols-2" aria-label="Password requirements">
      {rules.map(([valid, label]) => (
        <li key={label} className={`flex items-center gap-1.5 text-[11px] ${valid ? "text-emerald-700" : ""}`}>
          <span aria-hidden="true">{valid ? "✓" : "○"}</span>{label}
        </li>
      ))}
    </ul>
  );
}

function AuthField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-widest">
      <span className="mb-2 block">{label}</span>
      {children}
      {error && <span className="mt-1.5 block normal-case tracking-normal text-destructive">{error}</span>}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C37.2 38.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}
