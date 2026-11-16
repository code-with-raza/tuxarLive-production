import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";

export const Route = createFileRoute("/$locale/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Tuxar" },
      { name: "description", content: "Choose a new password for your Tuxar account." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ResetPassword,
});

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type Fields = z.infer<typeof schema>;

function ResetPassword() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { isLoading, updatePassword } = useUser();
  const [complete, setComplete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const accountLink = getLocalizedLink("/account", locale);
  const forgotLink = getLocalizedLink("/forgot-password", locale);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: Fields) => {
    setServerError(null);
    try {
      await updatePassword(password);
      setComplete(true);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "This reset link is invalid or expired. Please request a new one.",
      );
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container-luxe flex min-h-[60vh] items-center justify-center py-24">
      <div className="w-full max-w-[430px] text-center">
        {complete ? (
          <>
            <CheckCircle2 className="mx-auto mb-5 h-10 w-10" strokeWidth={1.3} />
            <h1 className="font-display text-4xl">Password updated</h1>
            <p className="mt-4 text-sm text-muted-foreground">Your new password is active and your account is ready.</p>
            <Link to={accountLink.to} params={accountLink.params} className="mt-8 inline-block underline underline-offset-4">Continue to your account</Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl">Choose a new password</h1>
            <p className="mt-3 text-sm text-muted-foreground">Use at least eight characters.</p>
            {serverError && <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/10 p-4 text-left text-sm text-destructive">{serverError}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5 text-left" noValidate>
              <PasswordField label="New password" error={errors.password?.message}>
                <input type="password" autoComplete="new-password" {...register("password")} className="h-11 w-full border border-border px-3 text-sm outline-none focus:border-foreground" />
              </PasswordField>
              <PasswordField label="Confirm new password" error={errors.confirmPassword?.message}>
                <input type="password" autoComplete="new-password" {...register("confirmPassword")} className="h-11 w-full border border-border px-3 text-sm outline-none focus:border-foreground" />
              </PasswordField>
              <button type="submit" disabled={isSubmitting} className="flex h-12 w-full items-center justify-center gap-2 bg-foreground text-sm uppercase tracking-widest text-background disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </button>
            </form>
            <Link to={forgotLink.to} params={forgotLink.params} className="mt-7 inline-block text-sm underline underline-offset-4">Request a new link</Link>
          </>
        )}
      </div>
    </div>
  );
}

function PasswordField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-widest">
      <span className="mb-2 block">{label}</span>
      {children}
      {error && <span className="mt-1.5 block normal-case tracking-normal text-destructive">{error}</span>}
    </label>
  );
}
