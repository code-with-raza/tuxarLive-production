import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ChevronRight, Calendar, User } from "lucide-react";
import { blogDateTime, formatBlogDate } from "@/lib/blog/date";
import { t, Locale, getLocalizedLink, getLocalizedSlug, resolveSlug, BLOG_SLUG_MAP } from "@/i18n/i18n";
import { localizedAlternates } from "@/lib/seo";

const SITE_URL = "https://tuxar.co.uk";


const byLabel = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "Di";
    case "de":
      return "Von";
    case "fr":
      return "Par";
    case "es":
      return "Por";
    default:
      return "By";
  }
};

const backLabel = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "Torna al Diario";
    case "de":
      return "Zurück zum Journal";
    case "fr":
      return "Retour au Journal";
    case "es":
      return "Volver al Diario";
    default:
      return "Back to Journal";
  }
};

export const Route = createFileRoute("/$locale/blog/$slug")({
  beforeLoad: ({ params }) => {
    const locale = params.locale as Locale;
    const slug = getLocalizedSlug(resolveSlug(params.slug, "blog", locale), "blog", locale);
    if (slug !== params.slug) throw redirect({ to: "/$locale/blog/$slug", params: { locale, slug }, search: true, replace: true, statusCode: 301 });
  },
  staleTime: 0,
  loader: async ({ params }) => {
    const { getPublishedPost } = await import("@/lib/blog/published");
    const post = await getPublishedPost(params.slug, params.locale as Locale);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post;
    const locale = params.locale as Locale;
    if (!post) {
      return {
        meta: [
          { title: "Article not found — Tuxar" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }

    const url = `/${locale}/blog/${params.slug}`;
    const fullUrl = `${SITE_URL}${url}`;
    const canonicalSlug = resolveSlug(params.slug, "blog", locale);
    const imageUrl = post.image?.startsWith("http") ? post.image : `${SITE_URL}${post.image}`;

    // Use metaTitle/metaDescription from frontmatter if available via excerpt
    const journalName = { en:"The Tuxar Journal",de:"Das Tuxar Journal",es:"El Diario Tuxar",fr:"Le Journal Tuxar",it:"Il Diario Tuxar" }[locale];
    const metaTitle = post.seo?.metaTitle || `${post.title} — ${journalName}`;
    const metaDesc = post.seo?.metaDescription || post.excerpt || "";

    return {
      meta: [
        // Core
        { title: metaTitle },
        { name: "description", content: metaDesc },
        // Open Graph — Article
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: journalName },
        { property: "og:url", content: fullUrl },
        { property: "og:title", content: metaTitle },
        { property: "og:description", content: metaDesc },
        { property: "og:image", content: imageUrl },
        { property: "og:image:alt", content: post.title },
        {
          property: "og:locale",
          content:
            locale === "en"
              ? "en_GB"
              : locale === "it"
                ? "it_IT"
                : locale === "de"
                  ? "de_DE"
                  : locale === "fr"
                    ? "fr_FR"
                    : "es_ES",
        },
        { property: "article:author", content: post.author || "Tuxar Atelier" },
        { property: "article:section", content: post.category },
        ...(post.date
          ? [{ property: "article:published_time", content: new Date(post.date).toISOString() }]
          : []),
        // Twitter Cards
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@tuxaratelier" },
        { name: "twitter:title", content: metaTitle },
        { name: "twitter:description", content: metaDesc },
        { name: "twitter:image", content: imageUrl },
        { name: "twitter:image:alt", content: post.title },
      ],
      links: [
        { rel: "canonical", href: fullUrl },
        ...(post.translations ? [
          ...Object.entries(post.translations).map(([language, slug]) => ({ rel: "alternate", hrefLang: language, href: `${SITE_URL}/${language}/blog/${slug}` })),
          { rel: "alternate", hrefLang: "x-default", href: post.translations.en ? `${SITE_URL}/en/blog/${post.translations.en}` : fullUrl },
        ] : BLOG_SLUG_MAP[canonicalSlug] ? localizedAlternates(
          (targetLocale) =>
            `/${targetLocale}/blog/${getLocalizedSlug(canonicalSlug, "blog", targetLocale)}`,
        ) : [{ rel: "alternate", hrefLang: locale, href: fullUrl }]),
      ],
      scripts: [
        // BlogPosting schema
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${fullUrl}#blogposting`,
            url: fullUrl,
            headline: post.title,
            description: metaDesc,
            image: {
              "@type": "ImageObject",
              url: imageUrl,
              description: post.title,
            },
            datePublished: post.date ? new Date(post.date).toISOString() : "2026-06-11T00:00:00Z",
            dateModified: post.date ? new Date(post.date).toISOString() : "2026-06-11T00:00:00Z",
            author: {
              "@type": "Organization",
              name: post.author || "Tuxar Atelier",
              url: SITE_URL,
            },
            publisher: {
              "@type": "Organization",
              name: "Tuxar Atelier",
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.ico`,
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": fullUrl,
            },
            articleSection: post.category,
            inLanguage: locale,
          }),
        },
        // BreadcrumbList schema
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
  },
  component: BlogPost,
  notFoundComponent: () => (
    <div className="container-luxe py-32 text-center">
      <h1 className="font-display text-4xl">Article not found</h1>
      <Link to="/blog" className="mt-6 inline-block underline">
        Back to Journal
      </Link>
    </div>
  ),
});

function BlogPost() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { post } = Route.useLoaderData();

  const homeLink = getLocalizedLink("/", locale);
  const blogLink = getLocalizedLink("/blog", locale);

  return (
    <>
      {/* Breadcrumb navigation */}
      <div className="container-luxe py-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          <Link to={homeLink.to} params={homeLink.params} className="hover:text-foreground">
            {t("common.home", locale)}
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link to={blogLink.to} params={blogLink.params} className="hover:text-foreground">
            {t("nav.blog", locale)}
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-foreground line-clamp-1" aria-current="page">
            {post.title}
          </span>
        </nav>
      </div>

      {/* Article header */}
      <header className="container-luxe max-w-4xl pt-8 pb-12 md:pb-16 text-center">
        <div className="eyebrow mb-4 inline-block px-3 py-1 bg-section rounded-sm text-foreground/80">
          {post.category}
        </div>
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-6">
          {post.title}
        </h1>

        {/* Article meta */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground uppercase tracking-widest mt-6">
          <span className="flex items-center gap-1.5 font-sans">
            <User className="h-3.5 w-3.5" aria-hidden="true" />
            {byLabel(locale)} {post.author || "Tuxar Atelier"}
          </span>
          <span className="flex items-center gap-1.5 font-sans">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={blogDateTime(post.date)}>{formatBlogDate(post.date, locale)}</time>
          </span>
        </div>
      </header>

      {/* Featured image */}
      {post.image && (
        <div className="container-luxe max-w-5xl mb-12 md:mb-16">
          <div className="aspect-[21/9] w-full overflow-hidden bg-section">
            <img
              src={post.image}
              onError={event => { const img = event.currentTarget; if (post.imageFallback && img.getAttribute("src") !== post.imageFallback) img.src = post.imageFallback; }}
              alt={post.seo.imageAlt || post.title}
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
              width={1260}
              height={540}
            />
          </div>
        </div>
      )}

      {/* Article body — Markdown is parsed to HTML on the server */}
      <article
        className="container-luxe max-w-3xl pb-24"
        itemScope
        itemType="https://schema.org/BlogPosting"
      >
        <meta itemProp="headline" content={post.title} />
        <meta itemProp="author" content={post.author || "Tuxar Atelier"} />
        {post.date && <meta itemProp="datePublished" content={post.date} />}

        <div
          className="journal-content rich-text-content prose prose-neutral max-w-none text-foreground/90 font-serif text-lg leading-relaxed
            prose-headings:font-display prose-headings:text-foreground prose-headings:font-normal
            prose-h1:hidden
            prose-h2:text-3xl prose-h2:mt-14 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-2
            prose-p:my-5 prose-p:leading-8
            prose-a:text-foreground prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-semibold
            prose-blockquote:border-l-4 prose-blockquote:border-foreground/30
            prose-blockquote:pl-5 prose-blockquote:italic prose-blockquote:text-foreground/75
            prose-hr:border-border prose-hr:my-10
            prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-1
            prose-ol:list-decimal prose-ol:pl-6 prose-ol:space-y-1
            prose-table:border-collapse prose-table:w-full prose-table:text-sm
            prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-section prose-th:text-left prose-th:font-semibold
            prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2
            prose-img:rounded-sm prose-img:w-full"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <div className="mt-16 pt-8 border-t border-border flex justify-between items-center">
          <Link
            to={blogLink.to}
            params={blogLink.params}
            className="text-xs uppercase tracking-widest font-semibold border-b border-foreground pb-1 hover:text-muted-foreground transition"
          >
            ← {backLabel(locale)}
          </Link>
          <div className="text-xs text-muted-foreground">Tuxar — Leather, honestly made</div>
        </div>
      </article>
    </>
  );
}
