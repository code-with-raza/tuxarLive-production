import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Locale, t, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";
import { AccountCheckError } from "@/components/AccountCheckError";

export const Route = createFileRoute("/$locale/login")({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    return {
      meta: [
        { title: `${t("nav.account", locale) || "Account"} — Tuxar` },
        { name: "description", content: "Sign in securely to your Tuxar customer account." },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  component: Login,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginFields = z.infer<typeof loginSchema>;

function Login() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isLoading, authError, loginWithGoogle, loginWithEmail } = useUser();
  const [googlePending, setGooglePending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const registerLink = getLocalizedLink("/register", locale);
  const forgotLink = getLocalizedLink("/forgot-password", locale);
  const accountLink = getLocalizedLink("/account", locale);
  const safeReturnTo = returnTo?.startsWith(`/${locale}/`) ? returnTo : accountLink.to;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && !authError && user) {
      if (user.tuxarVerified) navigate({ to: safeReturnTo, replace: true });
      else navigate({ to: `/${locale}/verify-email`, search: { returnTo: safeReturnTo }, replace: true });
    }
  }, [user, isLoading, authError, safeReturnTo, locale, navigate]);

  const submitEmailLogin = async (values: LoginFields) => {
    setServerError(null);
    try {
      await loginWithEmail(values.email, values.password);
      // The auth-state effect applies the verified-account gate and return destination.
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in with those details.",
      );
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
      setServerError(error instanceof Error ? error.message : "Google sign-in failed.");
      setGooglePending(false);
    }
  };

  if (authError) return <AccountCheckError message={authError} />;

  if (isLoading || user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fieldClass =
    "h-11 w-full border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground";

  return (
    <div className="container-luxe py-20 md:py-28 flex justify-center">
      <div className="w-full max-w-[430px] animate-luxe-fade-up">
        <h1 className="font-display text-4xl mb-2 text-center md:text-left">Sign in</h1>
        <p className="text-muted-foreground mb-8 text-center md:text-left text-sm tracking-wide">
          Access your account, saved details and order information.
        </p>

        {serverError && (
          <div role="alert" className="p-4 mb-6 bg-destructive/10 text-destructive text-sm border-l-2 border-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(submitEmailLogin)} className="space-y-5" noValidate>
          <label className="block text-xs uppercase tracking-widest">
            <span className="mb-2 block">Email address</span>
            <input type="email" autoComplete="email" {...register("email")} className={fieldClass} />
            {errors.email && <span className="mt-1.5 block normal-case tracking-normal text-destructive">{errors.email.message}</span>}
          </label>
          <label className="block text-xs uppercase tracking-widest">
            <span className="mb-2 flex items-center justify-between">
              Password
              <Link to={forgotLink.to} params={forgotLink.params} className="normal-case tracking-normal underline underline-offset-4">
                Forgot password?
              </Link>
            </span>
            <input type="password" autoComplete="current-password" {...register("password")} className={fieldClass} />
            {errors.password && <span className="mt-1.5 block normal-case tracking-normal text-destructive">{errors.password.message}</span>}
          </label>
          <button
            type="submit"
            disabled={isSubmitting || googlePending}
            className="flex h-12 w-full items-center justify-center gap-2 bg-foreground text-sm font-medium uppercase tracking-widest text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
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
          Continue with Google
        </button>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          New to Tuxar?{" "}
          <Link to={registerLink.to} params={registerLink.params} search={{ returnTo: safeReturnTo }} className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
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
