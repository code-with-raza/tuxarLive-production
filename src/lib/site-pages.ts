import { publicSupabase, isSupabaseConfigured } from "./supabase";

/** Functional screens keep their controls; editorial pages can replace their full body. */
export const SITE_PAGES = {
  about: "About / Atelier", faq: "Frequently asked questions", "size-guide": "Size guide",
  "shipping-policy": "Shipping policy", "returns-policy": "Returns policy",
  "privacy-policy": "Privacy policy", "terms-conditions": "Terms and conditions",
  home: "Homepage introduction", contact: "Contact introduction", shop: "Shop introduction",
  sales: "Sale introduction", "leather-jackets": "Men’s jackets introduction",
  "women-leather-jackets": "Women’s jackets introduction", "leather-bags": "Bags introduction",
  "motorcycle-suits": "Motorcycle suits introduction", accessories: "Accessories introduction",
  blog: "Journal introduction",
} as const;
export type SitePageKey = keyof typeof SITE_PAGES;
export const REPLACEABLE_PAGES = new Set<string>(["about", "faq", "size-guide", "shipping-policy", "returns-policy", "privacy-policy", "terms-conditions"]);
export type SitePage = { locale: string; page_key: SitePageKey; title: string; description: string; content_html: string; status: "draft" | "published"; updated_at?: string };
export function sitePageKey(path: string): SitePageKey | undefined {
  const key = path.replace(/^\/(en|de|fr|it|es)\/?/, "").replace(/\/$/, "") || "home";
  return Object.hasOwn(SITE_PAGES, key) ? key as SitePageKey : undefined;
}
export async function getSitePage(path: string, locale: string): Promise<SitePage | null> {
  const key = sitePageKey(path);
  if (!key || !isSupabaseConfigured()) return null;
  const { data, error } = await publicSupabase.from("site_pages").select("*")
    .eq("page_key", key).eq("locale", locale).eq("status", "published")
    .abortSignal(AbortSignal.timeout(15000)).maybeSingle();
  if (error) throw new Error("Page content could not be loaded. Please try again.");
  return data?.page_key === key ? data as SitePage : null;
}
