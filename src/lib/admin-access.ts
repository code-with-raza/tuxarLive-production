import { redirect } from "@tanstack/react-router";
import { supabase } from "./supabase";

export async function requireCatalogStaff({ params }: { params: { locale: string } }) {
  const deny = () => { throw redirect({ to: "/$locale/admin", params: { locale: params.locale } }); };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return deny();
  const membership = await supabase.from("admin_users").select("role").eq("user_id", data.user.id).maybeSingle();
  if (membership.error || !["owner", "admin", "editor"].includes(membership.data?.role ?? "")) return deny();
  const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error || level.data.currentLevel !== "aal2") return deny();
}
