import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

if (import.meta.env.DEV && (!supabaseUrl || !supabasePublishableKey)) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Contact forms and authentication will not work until these are set in .env",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder-publishable-key",
  { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } },
);

// Public catalogue reads must not wait for (or inherit) a staff/customer session.
export const publicSupabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder-publishable-key",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "tuxar-public-catalogue" } },
);

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
