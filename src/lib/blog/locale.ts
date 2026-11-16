import { BLOG_SLUG_MAP, type Locale } from "@/i18n/i18n";
import type { BlogPost } from "./types";

/** Resolve canonical article key from any localized slug */
export function getCanonicalBlogKey(slug: string): string | null {
  for (const [canonical, localesMap] of Object.entries(BLOG_SLUG_MAP)) {
    if (Object.values(localesMap).includes(slug)) {
      return canonical;
    }
  }
  return null;
}

/** Whether a slug belongs to the given locale */
export function isBlogSlugForLocale(slug: string, locale: Locale): boolean {
  const canonical = getCanonicalBlogKey(slug);
  if (!canonical) return false;
  return BLOG_SLUG_MAP[canonical]?.[locale] === slug;
}

/** Filter posts to those available in the requested locale */
export function filterPostsByLocale<T extends Pick<BlogPost, "slug">>(
  posts: T[],
  locale: Locale,
): T[] {
  return posts.filter((post) => isBlogSlugForLocale(post.slug, locale));
}

/** All localized slugs for hreflang alternates */
export function getBlogAlternateUrls(
  canonicalKey: string,
  siteUrl: string,
): { locale: Locale; url: string }[] {
  const localesMap = BLOG_SLUG_MAP[canonicalKey];
  if (!localesMap) return [];
  return (Object.entries(localesMap) as [Locale, string][]).map(([locale, slug]) => ({
    locale,
    url: `${siteUrl}/${locale}/blog/${slug}`,
  }));
}
