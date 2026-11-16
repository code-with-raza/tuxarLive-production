import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { Loader2, Settings, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/$locale/account/profile")({
  component: AccountProfile,
});

const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
});

type ProfileFields = z.infer<typeof profileSchema>;

function AccountProfile() {
  const { user, refetch } = useUser();
  const [profileError, setProfileError] = useState<string | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
  }, [user, reset]);

  const onProfileSubmit = async (data: ProfileFields) => {
    setProfileError(null);
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        full_name: `${data.firstName} ${data.lastName}`.trim(),
      },
    });
    if (error) {
      setProfileError(error.message || "Failed to update profile details.");
      return;
    }
    await refetch();
    toast.success("Profile details updated successfully");
  };

  return (
    <div className="space-y-12 animate-luxe-fade-in">
      <div>
        <h1 className="font-display text-3xl mb-1">Profile Settings</h1>
        <p className="text-sm text-muted-foreground font-sans">
          Update your personal details and account settings.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="border border-border p-6 bg-surface space-y-6">
          <h3 className="font-display text-lg tracking-tight flex items-center gap-2 border-b pb-4">
            <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.4} />
            Personal Information
          </h3>

          {profileError && (
            <div className="p-4 bg-destructive/10 text-destructive text-xs border-l-2 border-destructive">
              {profileError}
            </div>
          )}

          <form
            onSubmit={handleSubmitProfile(onProfileSubmit)}
            className="space-y-4 font-sans text-sm"
          >
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                First Name
              </label>
              <input
                type="text"
                {...registerProfile("firstName")}
                className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                  profileErrors.firstName
                    ? "border-destructive focus:border-destructive"
                    : "border-foreground/20 focus:border-foreground"
                }`}
              />
              {profileErrors.firstName && (
                <span className="text-destructive text-xs mt-1">
                  {profileErrors.firstName.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Last Name
              </label>
              <input
                type="text"
                {...registerProfile("lastName")}
                className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                  profileErrors.lastName
                    ? "border-destructive focus:border-destructive"
                    : "border-foreground/20 focus:border-foreground"
                }`}
              />
              {profileErrors.lastName && (
                <span className="text-destructive text-xs mt-1">
                  {profileErrors.lastName.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Email Address
              </label>
              <input
                type="email"
                {...registerProfile("email")}
                readOnly
                className="w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm border-foreground/20 text-muted-foreground cursor-not-allowed"
              />
              <span className="text-[11px] text-muted-foreground mt-1">
                Email is managed by your Google account.
              </span>
            </div>

            <button
              type="submit"
              disabled={isProfileSubmitting}
              className="h-11 px-6 bg-foreground text-background uppercase tracking-widest text-xs hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 cursor-pointer font-medium disabled:opacity-50"
            >
              {isProfileSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Details
            </button>
          </form>
        </div>

        <div className="border border-border p-6 bg-surface space-y-6">
          <h3 className="font-display text-lg tracking-tight flex items-center gap-2 border-b pb-4">
            <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.4} />
            Security & Password
          </h3>
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            You signed in with Google. Password and 2FA are managed in your Google Account
            settings — no separate Tuxar password is required.
          </p>
          <a
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center px-6 border border-border hover:bg-section uppercase tracking-widest text-xs transition-colors font-medium text-foreground"
          >
            Open Google Security
          </a>
        </div>
      </div>
    </div>
  );
}
