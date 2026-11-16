import { getLocalizedSlug, type Locale } from "@/i18n/i18n";
import { storefrontManagedCategories } from "@/lib/catalogCategories";
import { PREVIEW_CATEGORY_OPTIONS } from "@/lib/preview-category-options";
import { collectionAudience, getAudienceCollection, type ProductAudience } from "@/lib/product-audience";

export type AdminCategoryRow = {
  storefrontSlug?: string;
  id: string; slug: string; name: string; description: string; status: string;
  position: number; audience: string; show_hero: boolean; show_description: boolean;
  show_product_count: boolean; show_filters: boolean;
};
export const isVirtualCategory = (id: string) => id.startsWith("storefront--");

/** Include every built-in storefront collection as well as custom database categories. */
export function adminCategoryRows(rows: AdminCategoryRow[], audience: ProductAudience): AdminCategoryRow[] {
  const available = storefrontManagedCategories(rows, audience);
  const used = new Set<string>();
  const builtIn = PREVIEW_CATEGORY_OPTIONS.filter(collection => collectionAudience(collection.slug) === audience).map((collection, position) => {
    const stored = available.find(row => row.slug === collection.slug)
      ?? available.find(row => !used.has(row.id) && getAudienceCollection(row.slug, row.name, audience, PREVIEW_CATEGORY_OPTIONS)?.slug === collection.slug);
    if (stored) { used.add(stored.id); return { ...stored, name: collection.title, storefrontSlug: collection.slug }; }
    return { id: "storefront--" + collection.slug, storefrontSlug: collection.slug, slug: collection.slug, name: collection.title,
      description: collection.description, audience, status: "active", position,
      show_hero: true, show_description: true, show_product_count: true, show_filters: true };
  });
  return [...builtIn, ...available.filter(row => !used.has(row.id))];
}

export function readCategoryAudience(): ProductAudience | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("audience");
  return value === "men" || value === "women" ? value : null;
}
export function persistCategoryAudience(audience: ProductAudience | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("section", "categories");
  if (audience) url.searchParams.set("audience", audience);
  else url.searchParams.delete("audience");
  window.history.replaceState(window.history.state, "", url);
}

export function adminCategoryStorefrontHref(row: AdminCategoryRow, audience: ProductAudience, locale: Locale = "en") {
  const slug = row.storefrontSlug ?? row.slug;
  if (["leather-jackets", "women-leather-jackets", "motorcycle-suits", "leather-bags", "accessories"].includes(slug)) return `/${locale}/${slug}`;
  if (row.storefrontSlug) return `/${locale}/collections/${getLocalizedSlug(slug, "collection", locale)}`;
  return `/${locale}/${slug}?audience=${audience}`;
}
