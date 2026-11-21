import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Clock, Tag } from "lucide-react";
import { blogDateTime, formatBlogDate } from "@/lib/blog/date";
import { t, Locale, getLocalizedLink } from "@/i18n/i18n";
import { PageHero } from "@/components/site/PageHero";
import type { BlogPost } from "@/lib/blog/types";
import { localizedAlternates } from "@/lib/seo";
import { getProductAsset } from "@/assets";

const SITE_URL = "https://tuxar.co.uk";
const DEFAULT_OG_IMAGE = getProductAsset("/blog_images/italian-leather.webp");

const journalTitle = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "Il Diario Tuxar";
    case "de":
      return "Das Tuxar Journal";
    case "fr":
      return "Le Journal Tuxar";
    case "es":
      return "El Diario Tuxar";
    default:
      return "The Tuxar Journal";
  }
};

const journalDesc = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "Storie di materiali, cura, stile e prodotti pensati per durare.";
    case "de":
      return "Geschichten über Handwerkskunst, Stil und Erbe aus unserem Atelier in Mailand und Florenz.";
    case "fr":
      return "Histoires de matières, d'entretien, de style et de produits conçus pour durer.";
    case "es":
      return "Historias de materiales, cuidado, estilo y productos pensados para durar.";
    default:
      return "Practical stories about leather craftsmanship, care, fit and enduring style from Tuxar.";
  }
};

const emptyMsg = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "Nessun articolo disponibile in questa lingua.";
    case "de":
      return "Keine Artikel in dieser Sprache verfügbar.";
    case "fr":
      return "Aucun article disponible dans cette langue.";
    case "es":
      return "No hay artículos disponibles en este idioma.";
    default:
      return "No articles available in this language.";
  }
};

const readLabel = (locale: Locale) => {
  switch (locale) {
    case "it":
      return "min";
    case "de":
      return "Min";
    case "fr":
      return "min";
    case "es":
      return "min";
    default:
      return "min";
  }
};

export const Route = createFileRoute("/$locale/blog/")({
  staleTime: 0,
  loader: async ({ params }) => {
    const { getPublishedPosts } = await import("@/lib/blog/published");
    return getPublishedPosts(params.locale as Locale);
  },
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${journalTitle(locale)} — Tuxar`;
    const description = journalDesc(locale);
    const fullUrl = `${SITE_URL}/${locale}/blog`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Open Graph
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Tuxar — The Journal" },
        { property: "og:url", content: fullUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
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
        // Twitter Cards
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@tuxaratelier" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: fullUrl },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/blog`),
      ],
    };
  },
  component: JournalIndex,
});

function JournalIndex() {
  const { locale } = Route.useParams() as { locale: Locale };
  const posts = Route.useLoaderData() as BlogPost[];

  const title = journalTitle(locale);
  const description = journalDesc(locale);

  return (
    <>
      <PageHero
        eyebrow={t("nav.blog", locale)}
        title={title}
        description={description}
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.blog", locale) },
        ]}
      />

      <section className="container-luxe py-20" aria-label="Journal articles">
        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{emptyMsg(locale)}</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {posts.map((post) => {
              const postLink = getLocalizedLink("/blog/$slug", locale, { slug: post.slug });
              return (
                <article key={post.slug} className="group flex flex-col">
                  <Link to={postLink.to} params={postLink.params} className="block" tabIndex={0}>
                    {/* Thumbnail */}
                    <div className="w-full aspect-[4/3] overflow-hidden bg-section mb-4">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        width={480}
                        height={360}
                      />
                    </div>

                    {/* Category + read time */}
                    <div className="flex items-center gap-3 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
                      {post.category && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" aria-hidden="true" />
                          {post.category}
                        </span>
                      )}
                      {post.readMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {post.readMinutes} {readLabel(locale)} read
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-display group-hover:underline underline-offset-4 decoration-1 leading-snug mb-2">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>

                    {/* Date */}
                    {post.date && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        <time dateTime={blogDateTime(post.date)}>{formatBlogDate(post.date, locale)}</time>
                      </div>
                    )}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
