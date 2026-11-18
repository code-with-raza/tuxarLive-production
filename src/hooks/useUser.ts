import { useEffect, useState, useCallback, useRef } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";

const authConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
);

export type AppUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: "CUSTOMER" | "ADMIN";
  tuxarVerified: boolean;
  registrationMethod: "email" | "google";
};

function mapUser(user: SupabaseUser | null, profile?: { tuxar_verified?: boolean; registration_method?: string; account_status?: string } | null): AppUser | null {
  if (!user || profile?.account_status === "disabled") return null;
  const meta = user.user_metadata ?? {};
  const fullName =
    (meta.full_name as string | undefined) || (meta.name as string | undefined) || "";
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  const lastName =
    (meta.last_name as string | undefined) ||
    (meta.family_name as string | undefined) ||
    rest.join(" ");

  return {
    id: user.id,
    email: user.email || "",
    firstName:
      (meta.first_name as string | undefined) ||
      (meta.given_name as string | undefined) ||
      firstName ||
      "Client",
    lastName: lastName || "",
    avatarUrl: (meta.avatar_url as string | undefined) || (meta.picture as string | undefined),
    role: "CUSTOMER",
    tuxarVerified: profile?.tuxar_verified === true && profile.account_status === "active",
    registrationMethod:
      profile?.registration_method === "google" || user.app_metadata?.provider === "google"
        ? "google"
        : "email",
  };
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const authRevision = useRef(0);
  const observedSession = useRef<{ userId: string; accessToken: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    let authTimer: ReturnType<typeof setTimeout> | undefined;

    if (!authConfigured) {
      setIsLoading(false);
      return;
    }

    const initialiseAuth = () => {
      void import("@/lib/supabase").then(({ supabase }) => {
        if (!mounted) return;

        const setSessionUser = async (sessionUser: SupabaseUser | null) => {
          const revision = ++authRevision.current;
          setIsLoading(true);
          setAuthError(null);
          try {
            if (!sessionUser) {
              if (mounted && revision === authRevision.current) setUser(null);
              return;
            }
            const { data: profile, error } = await supabase.from("customer_profiles").select("tuxar_verified,registration_method,account_status").eq("user_id", sessionUser.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
            if (error) throw error;
            if (mounted && revision === authRevision.current) setUser(mapUser(sessionUser, profile));
          } catch {
            if (mounted && revision === authRevision.current) {
              // Let a later focus event retry a failed account check.
              observedSession.current = null;
              setUser(null);
              setAuthError("We couldn't check your account. Please try again.");
            }
          } finally {
            // An older profile request must never release a newer request's guard.
            if (mounted && revision === authRevision.current) setIsLoading(false);
          }
        };

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          // Supabase emits SIGNED_IN again when this tab regains focus. If the
          // actual session has not changed, restarting loading only hides the
          // workspace and repeats requests; it adds no authentication check.
          const previous = observedSession.current;
          if (_event === "SIGNED_IN" && session?.access_token &&
              previous?.userId === session.user.id && previous.accessToken === session.access_token) return;
          observedSession.current = session?.access_token
            ? { userId: session.user.id, accessToken: session.access_token }
            : null;
          // INITIAL_SESSION supplies the saved session too. A second getSession()
          // request races this event and used to release checkout before its user loaded.
          // Defer database work until Supabase releases its auth callback lock.
          const revision = ++authRevision.current;
          setIsLoading(true);
          setTimeout(() => {
            if (mounted && revision === authRevision.current) void setSessionUser(session?.user ?? null);
          }, 0);
        });
        unsubscribe = () => subscription.unsubscribe();
      }).catch(() => {
        if (mounted) {
          setAuthError("We couldn't load sign-in. Please try again.");
          setIsLoading(false);
        }
      });
    };

    const hasOAuthCallback =
      window.location.hash.includes("access_token=") ||
      window.location.search.includes("code=");

    // Process OAuth callbacks immediately so credentials are removed from the URL.
    // On ordinary catalogue visits, delay the network-heavy client until after first paint.
    if (hasOAuthCallback) initialiseAuth();
    else authTimer = setTimeout(initialiseAuth, 800);

    return () => {
      mounted = false;
      authRevision.current += 1;
      observedSession.current = null;
      if (authTimer) clearTimeout(authTimer);
      unsubscribe?.();
    };
  }, []);

  const loginWithGoogle = useCallback(async (redirectTo?: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) {
      toast.error(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
      );
      throw new Error("Supabase not configured");
    }

    const fallbackRedirect = `${window.location.origin}/en/account`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo || fallbackRedirect,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      toast.error(error.message || "Failed to start Google sign-in");
      throw error;
    }
  }, []);

  const registerWithEmail = useCallback(
    async ({
      firstName,
      lastName,
      email,
      password,
      redirectTo,
    }: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      redirectTo?: string;
    }) => {
      const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
      if (!isSupabaseConfigured()) throw new Error("Account registration is not configured yet.");

      void redirectTo;
      const { data, error } = await supabase.functions.invoke("start-email-registration", {
        body: { firstName, lastName, email: email.trim().toLowerCase(), password },
      });
      if (error || data?.error) {
        let message = data?.error || error?.message;
        const context = (error as { context?: Response } | null)?.context;
        if (!data?.error && context) {
          try { message = (await context.clone().json())?.error || message; } catch { /* use client message */ }
        }
        throw new Error(message && message !== "{}" ? message : "Account registration could not be started.");
      }
      return { needsEmailConfirmation: true };
    },
    [],
  );

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) throw new Error("Account sign-in is not configured yet.");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string, password: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) throw new Error("Account verification is not configured yet.");
    const { data, error } = await supabase.functions.invoke("verify-email-registration", { body: { email: email.trim().toLowerCase(), code: token } });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Verification failed.");
    const login = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (login.error) throw login.error;
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) throw new Error("Account verification is not configured yet.");
    const { data, error } = await supabase.functions.invoke("resend-email-registration", { body: { email: email.trim().toLowerCase() } });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Could not resend the code.");
  }, []);

  const requestPasswordReset = useCallback(async (email: string, redirectTo?: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) throw new Error("Account recovery is not configured yet.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectTo || `${window.location.origin}/en/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
    if (!isSupabaseConfigured()) throw new Error("Account recovery is not configured yet.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message || "Failed to log out");
      throw error;
    }
    setUser(null);
    toast.success("Logged out successfully");
  }, []);

  const refetch = useCallback(async () => {
    const revision = ++authRevision.current;
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user ?? null;
    if (revision !== authRevision.current) return;
    if (!sessionUser) { setUser(null); return; }
    const { data: profile } = await supabase.from("customer_profiles").select("tuxar_verified,registration_method,account_status").eq("user_id",sessionUser.id).maybeSingle();
    if (revision === authRevision.current) setUser(mapUser(sessionUser, profile));
  }, []);

  return {
    user,
    isLoading,
    authError,
    loginWithGoogle,
    registerWithEmail,
    loginWithEmail,
    verifySignupOtp,
    resendSignupOtp,
    requestPasswordReset,
    updatePassword,
    logout,
    isLoggingIn: false,
    isRegistering: false,
    isLoggingOut: false,
    refetch,
  };
}
