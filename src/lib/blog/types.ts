import type { Locale } from "@/i18n/i18n";

/** SEO metadata stored alongside each article */
export interface BlogPostSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterDescription?: string;
  imageAlt?: string;
  canonical?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string;
  lsiKeywords?: string;
}

/** Raw frontmatter shape from markdown files */
export interface BlogFrontmatter extends BlogPostSeo {
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  category: string;
  readMinutes?: number;
  author?: string;
  date?: string;
  schema?: string;
}

/** Article as served to the storefront */
export interface BlogPost {
  translationSourceId?: string;
  translations?: Partial<Record<Locale, string>>;
  imageFallback?: string;
  id: string;
  locale?: Locale;
  slug: string;
  title: string;
  excerpt: string;
  /** Rendered HTML body */
  contentHtml: string;
  /** Raw markdown body (for TOC / reading-time when needed) */
  contentMarkdown: string;
  image: string;
  category: string;
  readMinutes: number;
  author: string;
  date?: string;
  seo: BlogPostSeo;
}

/** Table-of-contents entry extracted from headings */
export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Adjacent navigation within the same locale */
export interface BlogAdjacentPosts {
  previous?: Pick<BlogPost, "slug" | "title" | "image">;
  next?: Pick<BlogPost, "slug" | "title" | "image">;
}

export interface BlogPostPageData {
  post: BlogPost;
  toc: TocItem[];
  related: Pick<BlogPost, "slug" | "title" | "excerpt" | "image" | "category" | "readMinutes" | "date">[];
  adjacent: BlogAdjacentPosts;
  locale: Locale;
  canonicalKey: string;
}
