import { publicSupabase, isSupabaseConfigured } from "../supabase";
import { getAllPostsFromMarkdown } from "./content";
import { filterPostsByLocale } from "./locale";
import { calculateReadMinutes, markdownToHtml } from "./markdown";
import { BLOG_SLUG_MAP, type Locale } from "@/i18n/i18n";
import type { BlogPost } from "./types";
import { getProductAsset } from "@/assets";
import { normalizeArticleBody } from "./article-body";

interface PublishedRow {
  translation_source_id?: string | null;
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
  // Status-only tombstones prevent bundled content reappearing after archiving/deletion.
  for (let offset = 0; offset < bundled.length; offset += 100) {
    const visibility = await publicSupabase.from("blog_publication_states")
      .select("slug,is_published").eq("locale", locale)
      .in("slug", bundled.slice(offset, offset + 100).map(post => post.slug))
      .abortSignal(AbortSignal.timeout(15000));
    if (visibility.error) throw new Error("The journal publication status could not be checked. Please try again.");
    for (const state of visibility.data ?? []) if (!state.is_published) posts.delete(state.slug);
  }
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await publicSupabase.from("blog_posts")
      .select("id,locale,slug,title,excerpt,content_markdown,category,author,cover_image_url,cover_image_alt,seo_title,seo_description,status,published_at,translation_source_id")
      .eq("status", "published").eq("locale", locale)
      .order("slug").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error("The journal could not be loaded. Please try again.");
    for (const row of (data ?? []) as PublishedRow[]) {
      if (row.status !== "published" || row.locale !== locale) continue;
      const previous = posts.get(row.slug);
      posts.set(row.slug, {
        id: row.id, locale, slug: row.slug, title: row.title,
        translationSourceId: row.translation_source_id || undefined,
        excerpt: row.excerpt, contentMarkdown: row.content_markdown,
        contentHtml: normalizeArticleBody(markdownToHtml(row.content_markdown), row.title),
        image: getProductAsset(row.cover_image_url || previous?.image || "/blog_images/italian-leather.webp"),
        imageFallback: previous?.image || getProductAsset("/blog_images/italian-leather.webp"),
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
  const post = (await getPublishedPosts(locale)).find(post => post.slug === slug);
  const group = post?.translationSourceId || post?.id;
  if (!post || !isSupabaseConfigured()) return post;
  let data: { locale: string; slug: string }[] = [];
  if (group && /^[a-f0-9-]{36}$/i.test(group)) {
    const result = await publicSupabase.from("blog_posts").select("locale,slug")
      .eq("status", "published").or(`id.eq.${group},translation_source_id.eq.${group}`)
      .abortSignal(AbortSignal.timeout(15000));
    if (result.error) throw new Error("Article languages could not be checked. Please try again.");
    data = result.data ?? [];
  }
  const translations: Partial<Record<Locale, string>> = { [locale]: slug };
  const legacy = Object.values(BLOG_SLUG_MAP).find(mapping => mapping[locale] === slug);
  if (legacy) {
    const bundledSlugs = new Set(getAllPostsFromMarkdown().map(item => item.slug));
    for (const [language, translated] of Object.entries(legacy)) if (bundledSlugs.has(translated)) translations[language as Locale] = translated;
    const visibility = await publicSupabase.from("blog_publication_states").select("locale,slug,is_published")
      .in("slug", Object.values(legacy)).abortSignal(AbortSignal.timeout(15000));
    if (visibility.error) throw new Error("Article languages could not be checked. Please try again.");
    for (const state of visibility.data ?? []) if (!state.is_published) delete translations[state.locale as Locale];
  }
  for (const row of data ?? []) if (["en", "de", "fr", "it", "es"].includes(row.locale)) translations[row.locale as Locale] = row.slug;
  return { ...post, translations };
}
