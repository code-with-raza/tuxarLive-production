import { publicSupabase, isSupabaseConfigured } from "./supabase";
import { applyCollectionContent, type CollectionContentRow } from "./collection-content";
import type { Collection } from "@/data/products";
import type { Locale } from "@/i18n/i18n";

export async function getStorefrontCollectionContent(fallback: Collection, locale: Locale) {
  if (!isSupabaseConfigured()) return fallback;
  const { data, error } = await publicSupabase.from("product_categories").select("*")
    .eq("slug", fallback.slug).eq("status", "active").abortSignal(AbortSignal.timeout(15000)).maybeSingle();
  if (error) throw new Error("Collection content could not be loaded. Check your connection and reload this page.");
  return applyCollectionContent(fallback, data as CollectionContentRow | null, locale);
}
