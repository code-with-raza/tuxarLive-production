import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";

export const Route = createFileRoute("/$locale/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Tuxar" },
      { name: "description", content: "Request a secure Tuxar account password reset." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ForgotPassword,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") });
type Fields = z.infer<typeof schema>;

function ForgotPassword() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { requestPasswordReset } = useUser();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const loginLink = getLocalizedLink("/login", locale);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: Fields) => {
    setServerError(null);
    try {
      await requestPasswordReset(email, `${window.location.origin}/${locale}/reset-password`);
      setSent(true);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const message = raw.toLowerCase();
      setServerError(
        /rate|too many|429/.test(message)
          ? "Too many reset requests. Please wait a few minutes and try again."
          : /smtp|email|send|not authorized|\{\}/.test(message)
            ? "We could not send the reset email. Please contact Tuxar support; our email delivery needs attention."
            : raw || "We could not send the reset link. Please try again later.",
      );
    }
  };

  return (
    <div className="container-luxe flex min-h-[60vh] items-center justify-center py-24">
      <div className="w-full max-w-[430px] text-center">
        {sent ? (
          <>
            <CheckCircle2 className="mx-auto mb-5 h-10 w-10" strokeWidth={1.3} />
            <h1 className="font-display text-4xl">Check your email</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              If an account exists for that email, a secure password-reset link is on its way.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl">Reset your password</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Enter your account email and we will send a secure reset link.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">If you created your account with Google and never set a Tuxar password, sign in with Google instead.</p>
            {serverError && <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/10 p-4 text-left text-sm text-destructive">{serverError}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5 text-left" noValidate>
              <label className="block text-xs uppercase tracking-widest">
                <span className="mb-2 block">Email address</span>
                <input type="email" autoComplete="email" {...register("email")} className="h-11 w-full border border-border px-3 text-sm outline-none focus:border-foreground" />
                {errors.email && <span className="mt-1.5 block normal-case tracking-normal text-destructive">{errors.email.message}</span>}
              </label>
              <button type="submit" disabled={isSubmitting} className="flex h-12 w-full items-center justify-center gap-2 bg-foreground text-sm uppercase tracking-widest text-background disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          </>
        )}
        <Link to={loginLink.to} params={loginLink.params} className="mt-8 inline-block text-sm underline underline-offset-4">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
