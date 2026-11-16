import { t, type Locale } from "@/i18n/i18n";
import { DEFAULT_OG_IMAGE, PUBLISHER_NAME, SITE_URL, TWITTER_HANDLE } from "./constants";
import { getBlogAlternateUrls } from "./locale";
import type { BlogPost, BlogPostSeo } from "./types";

const OG_LOCALE: Record<Locale, string> = {
  en: "en_GB",
  it: "it_IT",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
};

function resolveImageUrl(image?: string): string {
  if (!image) return DEFAULT_OG_IMAGE;
  return image.startsWith("http") ? image : `${SITE_URL}${image}`;
}

function parseIsoDate(date?: string): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function resolveSeoTitle(post: Pick<BlogPost, "title" | "seo">, suffix = "The Tuxar Journal"): string {
  return post.seo.metaTitle || `${post.title} — ${suffix}`;
}

export function resolveSeoDescription(post: Pick<BlogPost, "excerpt" | "seo">): string {
  return post.seo.metaDescription || post.seo.ogDescription || post.excerpt || "";
}

export function resolveOgTitle(post: Pick<BlogPost, "title" | "seo">): string {
  return post.seo.ogTitle || resolveSeoTitle(post);
}

export function resolveOgDescription(post: Pick<BlogPost, "excerpt" | "seo">): string {
  return post.seo.ogDescription || resolveSeoDescription(post);
}

export function resolveTwitterDescription(post: Pick<BlogPost, "excerpt" | "seo">): string {
  return post.seo.twitterDescription || resolveSeoDescription(post);
}

interface HeadMetaInput {
  locale: Locale;
  slug: string;
  post: BlogPost;
  canonicalKey: string;
}

export function buildBlogPostHead({ locale, slug, post, canonicalKey }: HeadMetaInput) {
  const url = `/${locale}/blog/${slug}`;
  const fullUrl = `${SITE_URL}${url}`;
  const imageUrl = resolveImageUrl(post.image);
  const imageAlt = post.seo.imageAlt || post.title;
  const title = resolveSeoTitle(post);
  const description = resolveSeoDescription(post);
  const ogTitle = resolveOgTitle(post);
  const ogDescription = resolveOgDescription(post);
  const twitterDescription = resolveTwitterDescription(post);
  const published = parseIsoDate(post.date);

  const alternates = getBlogAlternateUrls(canonicalKey, SITE_URL);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: `${PUBLISHER_NAME} — The Journal` },
      { property: "og:url", content: fullUrl },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:image", content: imageUrl },
      { property: "og:image:alt", content: imageAlt },
      { property: "og:locale", content: OG_LOCALE[locale] },
      { property: "article:author", content: post.author || PUBLISHER_NAME },
      { property: "article:section", content: post.category },
      ...(published ? [{ property: "article:published_time", content: published }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: TWITTER_HANDLE },
      { name: "twitter:title", content: ogTitle },
      { name: "twitter:description", content: twitterDescription },
      { name: "twitter:image", content: imageUrl },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [
      { rel: "canonical", href: fullUrl },
      ...alternates.map(({ locale: altLocale, url: altUrl }) => ({
        rel: "alternate" as const,
        hrefLang: altLocale,
        href: altUrl,
      })),
      { rel: "alternate" as const, hrefLang: "x-default", href: alternates.find(alternate => alternate.locale === "en")?.url ?? fullUrl },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${fullUrl}#blogposting`,
          url: fullUrl,
          headline: post.title,
          description,
          image: {
            "@type": "ImageObject",
            url: imageUrl,
            description: imageAlt,
          },
          datePublished: published || "2026-06-11T00:00:00.000Z",
          dateModified: published || "2026-06-11T00:00:00.000Z",
          author: {
            "@type": "Organization",
            name: post.author || PUBLISHER_NAME,
            url: SITE_URL,
          },
          publisher: {
            "@type": "Organization",
            name: PUBLISHER_NAME,
            url: SITE_URL,
            logo: {
              "@type": "ImageObject",
              url: `${SITE_URL}/favicon.ico`,
            },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": fullUrl },
          articleSection: post.category,
          inLanguage: locale,
          keywords: [post.seo.primaryKeyword, post.seo.secondaryKeywords, post.seo.lsiKeywords]
            .filter(Boolean)
            .join(", "),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": `${fullUrl}#breadcrumb`,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: t("common.home", locale),
              item: `${SITE_URL}/${locale}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: t("nav.blog", locale),
              item: `${SITE_URL}/${locale}/blog`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: post.title,
              item: fullUrl,
            },
          ],
        }),
      },
    ],
  };
}

interface IndexHeadInput {
  locale: Locale;
  title: string;
  description: string;
}

export function buildBlogIndexHead({ locale, title, description }: IndexHeadInput) {
  const fullUrl = `${SITE_URL}/${locale}/blog`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: `${PUBLISHER_NAME} — The Journal` },
      { property: "og:url", content: fullUrl },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:locale", content: OG_LOCALE[locale] },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: TWITTER_HANDLE },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: fullUrl }],
  };
}

/** Map DB / frontmatter fields into BlogPostSeo */
export function mapSeoFields(data: Record<string, unknown>): BlogPostSeo {
  const str = (key: string) => {
    const v = data[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    metaTitle: str("metaTitle"),
    metaDescription: str("metaDescription"),
    ogTitle: str("ogTitle"),
    ogDescription: str("ogDescription"),
    twitterDescription: str("twitterDescription"),
    imageAlt: str("imageAlt"),
    canonical: str("canonical"),
    primaryKeyword: str("primaryKeyword"),
    secondaryKeywords: str("secondaryKeywords"),
    lsiKeywords: str("lsiKeywords"),
  };
}
