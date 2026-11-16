import type { Locale } from "@/i18n/i18n";
import { filterPostsByLocale, getCanonicalBlogKey } from "./locale";
import type { BlogAdjacentPosts, BlogPost } from "./types";

function parsePostDate(date?: string): number {
  if (!date) return 0;
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortPostsByDate(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => parsePostDate(b.date) - parsePostDate(a.date));
}

export function getAdjacentPosts(
  posts: BlogPost[],
  currentSlug: string,
  locale: Locale,
): BlogAdjacentPosts {
  const localized = sortPostsByDate(filterPostsByLocale(posts, locale));
  const index = localized.findIndex((p) => p.slug === currentSlug);
  if (index === -1) return {};

  const pick = (p: BlogPost) => ({
    slug: p.slug,
    title: p.title,
    image: p.image,
  });

  return {
    previous: index > 0 ? pick(localized[index - 1]) : undefined,
    next: index < localized.length - 1 ? pick(localized[index + 1]) : undefined,
  };
}

export function getRelatedPosts(
  posts: BlogPost[],
  currentSlug: string,
  locale: Locale,
  category: string,
  limit = 3,
): Pick<BlogPost, "slug" | "title" | "excerpt" | "image" | "category" | "readMinutes" | "date">[] {
  const canonical = getCanonicalBlogKey(currentSlug);
  const localized = filterPostsByLocale(posts, locale).filter((p) => p.slug !== currentSlug);

  const sameCategory = localized.filter((p) => p.category === category);
  const pool = sameCategory.length >= limit ? sameCategory : localized;

  return sortPostsByDate(pool)
    .slice(0, limit)
    .map(({ slug, title, excerpt, image, category: cat, readMinutes, date }) => ({
      slug,
      title,
      excerpt,
      image,
      category: cat,
      readMinutes,
      date,
    }));
}
