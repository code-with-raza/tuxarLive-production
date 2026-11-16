import type { SupabaseClient } from "@supabase/supabase-js";

/** An explicit JSON body is required by the protected Edge Function contract. */
export function requestCustomerOtp(client: Pick<SupabaseClient, "functions">) {
  return client.functions.invoke("issue-customer-otp", { body: {} });
}
