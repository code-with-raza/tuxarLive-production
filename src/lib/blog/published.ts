import { publicSupabase, isSupabaseConfigured } from "../supabase";
import { getAllPostsFromMarkdown } from "./content";
import { filterPostsByLocale } from "./locale";
import { calculateReadMinutes, markdownToHtml } from "./markdown";
import type { Locale } from "@/i18n/i18n";
import type { BlogPost } from "./types";
import { getProductAsset } from "@/assets";

interface PublishedRow {
  id: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  author: string;
  cover_image_url: string | null;
  cover_image_alt: string;
  seo_title: string;
  seo_description: string;
  status: string;
  published_at: string | null;
}

/** Live public reads never inherit a staff session or expose draft articles. */
export async function getPublishedPosts(locale: Locale): Promise<BlogPost[]> {
  const bundled = filterPostsByLocale(getAllPostsFromMarkdown(), locale);
  if (!isSupabaseConfigured()) return bundled;
  const posts = new Map(bundled.map(post => [post.slug, post]));
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await publicSupabase.from("blog_posts")
      .select("id,locale,slug,title,excerpt,content_markdown,category,author,cover_image_url,cover_image_alt,seo_title,seo_description,status,published_at")
      .eq("status", "published").eq("locale", locale)
      .order("slug").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error("The journal could not be loaded. Please try again.");
    for (const row of (data ?? []) as PublishedRow[]) {
      if (row.status !== "published" || row.locale !== locale) continue;
      const previous = posts.get(row.slug);
      posts.set(row.slug, {
        id: row.id, locale, slug: row.slug, title: row.title,
        excerpt: row.excerpt, contentMarkdown: row.content_markdown,
        contentHtml: markdownToHtml(row.content_markdown),
        image: row.cover_image_url || previous?.image || getProductAsset("/blog_images/italian-leather.webp"),
        category: row.category, author: row.author,
        date: row.published_at || undefined,
        readMinutes: calculateReadMinutes(row.content_markdown),
        seo: { metaTitle: row.seo_title, metaDescription: row.seo_description, imageAlt: row.cover_image_alt },
      });
    }
    if ((data?.length ?? 0) < 100) break;
  }
  return [...posts.values()].sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
}

export async function getPublishedPost(slug: string, locale: Locale) {
  return (await getPublishedPosts(locale)).find(post => post.slug === slug);
}
