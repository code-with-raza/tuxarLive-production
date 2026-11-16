import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ProductCard } from "@/components/site/ProductCard";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import {
  t,
  Locale,
  getLocalizedCollection,
  getLocalizedProduct,
  resolveSlug,
  getLocalizedSlug,
  getLocalizedLink,
} from "@/i18n/i18n";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { COLLECTIONS, PRODUCTS, type Collection, type Product } from "@/data/products";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { collectionAudience, isProductForAudience } from "@/lib/product-audience";

export const Route = createFileRoute("/$locale/collections/$slug")({
  beforeLoad: ({ params }) => {
    const locale = params.locale as Locale;
    const id = resolveSlug(params.slug, "collection", locale);
    const currentSlug = getLocalizedSlug(id, "collection", locale);
    if (currentSlug !== params.slug) throw redirect({
      to: "/$locale/collections/$slug",
      params: { locale, slug: currentSlug },
      search: true,
      replace: true,
      statusCode: 301,
    });
  },
  loader: async ({ params }) => {
    const locale = params.locale as Locale;
    const canonicalSlug = resolveSlug(params.slug, "collection", locale);

    const rawCollection = COLLECTIONS.find((c) => c.slug === canonicalSlug);
    // Truly unknown slug (not in data at all) → real 404
    if (!rawCollection) throw notFound();

    const audience = collectionAudience(canonicalSlug);
    const sourceSlug = rawCollection.sourceCollection ?? canonicalSlug;
    const products = (await getStorefrontProducts()).filter((p) => (p.collections?.includes(canonicalSlug) || p.collections?.includes(sourceSlug)) && (!audience || isProductForAudience(p, audience)));
    // Historic placeholder flags must not hide an approved, populated collection.
    const comingSoon = products.length === 0;
    const collection = getLocalizedCollection(rawCollection, locale);

    // Empty collections remain placeholders.
    if (comingSoon) {
      return { collection, canonicalSlug, products: [], comingSoon: true };
    }

    return { collection, canonicalSlug, products, comingSoon: false };
  },
  head: ({ loaderData, params }) => {
    const collection = loaderData?.collection;
    const comingSoon = loaderData?.comingSoon ?? false;
    const locale = params.locale as Locale;
    if (!collection) {
      return {
        meta: [
          { title: "Collection not found — Tuxar" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }

    const localizedSlug = getLocalizedSlug(collection.slug, "collection", locale);
    const url = `/${locale}/collections/${localizedSlug}`;
    const fullUrl = absoluteUrl(url);
    const products = loaderData?.products ?? [];
    const hasLocalDrafts = products.some(product => "cataloguePreview" in product && product.cataloguePreview === true);
    const socialImage = absoluteUrl(collection.image);

    if (comingSoon) {
      // noindex so Google does not index empty category placeholder pages
      return {
        meta: [
          { title: `${collection.title} — Coming Soon | Tuxar` },
          {
            name: "description",
            content: `Discover the upcoming Tuxar ${collection.title} collection. This collection is currently being curated and will be available soon.`,
          },
          { name: "robots", content: "noindex, nofollow" },
        ],
        links: [],
      };
    }

    // Real collection pages — identical to original
    return {
      meta: [
          { title: collection.seoTitle || `${collection.title} | Tuxar` },
        { name: "description", content: collection.metaIntro },
        ...(hasLocalDrafts ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: `${collection.title} — Tuxar` },
        { property: "og:description", content: collection.metaIntro },
        { property: "og:type", content: "website" },
        { property: "og:url", content: fullUrl },
        { property: "og:image", content: socialImage },
        { property: "og:image:alt", content: collection.title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: collection.title },
        { name: "twitter:description", content: collection.metaIntro },
        { name: "twitter:image", content: socialImage },
      ],
      links: [
        { rel: "canonical", href: fullUrl },
        ...localizedAlternates(
          (targetLocale) =>
            `/${targetLocale}/collections/${getLocalizedSlug(collection.slug, "collection", targetLocale)}`,
        ),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": `${fullUrl}#webpage`,
            url: fullUrl,
            name: `${collection.title} — Tuxar`,
            description: collection.description,
            mainEntity: {
              "@type": "ItemList",
              "@id": `${fullUrl}#products`,
              numberOfItems: products.length,
              itemListElement: products.map((product, index) => {
                const localizedProduct = getLocalizedProduct(product, locale);
                return {
                  "@type": "ListItem",
                  position: index + 1,
                  name: localizedProduct.name,
                  url: absoluteUrl(
                    `/${locale}/product/${getLocalizedSlug(product.slug, "product", locale)}`,
                  ),
                };
              }),
            },
            isPartOf: {
              "@type": "WebSite",
              "@id": `https://tuxar.co.uk/${locale}/#website`,
              url: `https://tuxar.co.uk/${locale}/`,
              name: "Tuxar",
            },
            breadcrumb: {
              "@type": "BreadcrumbList",
              "@id": `${fullUrl}#breadcrumb`,
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: t("common.home", locale),
                  item: `https://tuxar.co.uk/${locale}/`,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: t("nav.shop", locale),
                  item: `https://tuxar.co.uk/${locale}/shop`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: collection.title,
                  item: fullUrl,
                },
              ],
            },
          }),
        },
      ],
    };
  },
  component: CollectionPage,
  notFoundComponent: CollectionNotFound,
});

function CollectionNotFound() {
    const { locale } = Route.useParams() as { locale: Locale };
    const shopLink = getLocalizedLink("/shop", locale);
    return (
      <div className="container-luxe py-32 text-center">
        <h1 className="font-display text-4xl">Collection not found</h1>
        <Link to={shopLink.to} params={shopLink.params} className="mt-6 inline-block underline">
          Back to shop
        </Link>
      </div>
    );
}

// ─── Coming Soon Page ─────────────────────────────────────────────────────────

function CollectionComingSoon({
  collection,
  locale,
}: {
  collection: { title: string; description: string };
  locale: Locale;
}) {
  const shopLink = getLocalizedLink("/shop", locale);

  const eyebrow =
    locale === "it"
      ? "Prossimamente"
      : locale === "de"
        ? "Demnächst"
        : locale === "fr"
          ? "Bientôt disponible"
          : locale === "es"
            ? "Próximamente"
            : "Upcoming Collection";

  const heading =
    locale === "it"
      ? `${collection.title} — In Arrivo`
      : locale === "de"
        ? `${collection.title} — Demnächst`
        : locale === "fr"
          ? `${collection.title} — Bientôt`
          : locale === "es"
            ? `${collection.title} — Próximamente`
            : `${collection.title} — Coming Soon`;

  const body =
    locale === "it"
      ? `Stiamo preparando una selezione curata di ${collection.title.toLowerCase()}. Questa collezione sarà disponibile a breve. Vi invitiamo a tornare presto.`
      : locale === "de"
        ? `Wir bereiten eine kuratierte Kollektion von ${collection.title.toLowerCase()} vor. Dieser Bereich wird in Kürze verfügbar sein. Schauen Sie bald wieder vorbei.`
        : locale === "fr"
          ? `Nous préparons une sélection soignée de ${collection.title.toLowerCase()}. Cette collection sera bientôt disponible. Nous vous invitons à revenir prochainement.`
          : locale === "es"
            ? `Estamos preparando una colección curada de ${collection.title.toLowerCase()}. Esta colección estará disponible en breve. Le invitamos a volver próximamente.`
            : `We are preparing a curated selection of ${collection.title.toLowerCase()}. This collection will be available soon. Please check back shortly.`;

  const cta =
    locale === "it"
      ? "Esplora le collezioni disponibili"
      : locale === "de"
        ? "Verfügbare Kollektionen entdecken"
        : locale === "fr"
          ? "Explorer les collections disponibles"
          : locale === "es"
            ? "Explorar colecciones disponibles"
            : "Explore Available Collections";

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-24 text-center">
      <Reveal repeat className="flex flex-col items-center">
        <div className="w-8 h-px bg-foreground/25 mb-10" />

      <p className="eyebrow mb-5">{eyebrow}</p>

      <h1 className="font-display text-4xl md:text-5xl lg:text-6xl max-w-2xl leading-tight">
        {heading}
      </h1>

      <div className="w-12 h-px bg-foreground/20 my-8" />

      <p className="text-sm md:text-base text-muted-foreground max-w-md leading-relaxed">{body}</p>

      <Link
        to={shopLink.to as any}
        params={shopLink.params as any}
        className="mt-10 inline-flex h-11 items-center justify-center border border-foreground px-8 text-[11px] tracking-[0.22em] uppercase font-sans text-foreground hover:bg-foreground hover:text-background transition-colors duration-200"
      >
        {cta}
      </Link>

        <div className="w-8 h-px bg-foreground/25 mt-10" />
      </Reveal>
    </div>
  );
}

// ─── Main Collection Page ─────────────────────────────────────────────────────

function CollectionPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { collection, canonicalSlug, products, comingSoon } = Route.useLoaderData() as {
    collection: Collection;
    canonicalSlug: string;
    products: Product[];
    comingSoon: boolean;
  };

  // Coming-soon branch — professional placeholder, not a 404
  if (comingSoon) {
    return <CollectionComingSoon collection={collection} locale={locale} />;
  }

  // Filter products belonging to this collection and localize them
  const items = products.map((p: any) => getLocalizedProduct(p, locale));

  const homeLink = getLocalizedLink("/", locale);
  const shopLink = getLocalizedLink("/shop", locale);

  return (
    <>
      <div className="container-luxe py-6">
        <Breadcrumbs
          items={[
            { label: t("common.home", locale), to: homeLink.to, params: homeLink.params },
            { label: t("nav.shop", locale), to: shopLink.to, params: shopLink.params },
            { label: collection.title },
          ]}
        />
      </div>

      <PageHero
        repeat
        eyebrow={t("categories.title", locale) || "Collection"}
        title={collection.title}
        description={collection.description}
      />

      <section className="container-luxe py-12 md:py-16">
        <Reveal repeat distance={12} amount={0.08} className="mb-6 text-sm text-muted-foreground">
          {items.length}{" "}
          {items.length === 1
            ? locale === "it"
              ? "articolo"
              : locale === "de"
                ? "Artikel"
                : locale === "fr"
                  ? "article"
                  : locale === "es"
                    ? "artículo"
                    : "piece"
            : locale === "it"
              ? "articoli"
              : locale === "de"
                ? "Artikel"
                : locale === "fr"
                  ? "articles"
                  : locale === "es"
                    ? "artículos"
                    : "pieces"}{" "}
          {locale === "it"
            ? "in questa collezione"
            : locale === "de"
              ? "in dieser Kollektion"
              : locale === "fr"
                ? "dans cette collection"
                : locale === "es"
                  ? "en esta colección"
                  : "in this collection"}
        </Reveal>

        {items.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {locale === "it"
              ? "Nessun articolo attualmente disponibile in questa collezione. Torna a trovarci presto."
              : locale === "de"
                ? "Derzeit sind keine Artikel in dieser Kollektion verfügbar. Schauen Sie bald wieder vorbei."
                : locale === "fr"
                  ? "Aucun article disponible pour le moment dans cette collection. Revenez bientôt."
                  : locale === "es"
                    ? "No hay artículos disponibles en esta colección en este momento. Vuelva pronto."
                    : "No items currently available in this collection. Check back soon for new drops from the workshop."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-9 md:gap-x-5 md:gap-y-11">
            {items.map((p, index) => (
              <ProductCard key={p.slug} p={p} priority={index < 4} />
            ))}
          </div>
        )}
      </section>

      {/* Editorial Content / SEO block */}
      <section className="bg-section py-20 md:py-24 border-t border-border">
        <Reveal repeat className="container-luxe max-w-4xl">
          <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6 text-center">
            {locale === "it"
              ? `Dietro il design — ${collection.title}`
              : locale === "de"
                ? `Hinter dem Design — ${collection.title}`
                : locale === "fr"
                  ? `Derrière le design — ${collection.title}`
                  : locale === "es"
                    ? `Detrás del diseño — ${collection.title}`
                    : `Behind the Design — ${collection.title}`}
          </h2>
          <div className="w-12 h-px bg-foreground/30 mx-auto mb-8" />
          <p className="font-serif text-lg md:text-xl text-foreground/80 leading-relaxed text-center italic mb-10">
            "{collection.description}"
          </p>
          <div className="prose prose-neutral max-w-none text-muted-foreground leading-relaxed space-y-6 text-justify">
            <p>{collection.seoContent}</p>
            <p>
              {locale === "it"
                ? "Ogni prodotto Tuxar in questa collezione rappresenta il nostro impegno per l'utilità a lungo termine, la selezione dei materiali e una costruzione affidabile."
                : locale === "de"
                  ? "Jedes Stück dieser Kollektion verbindet ausgewählte Materialien mit durchdachter Konstruktion und klaren Produktdetails."
                  : locale === "fr"
                    ? "Chaque pièce de cette collection associe des matières sélectionnées, une construction réfléchie et des détails produit clairs."
                    : locale === "es"
                      ? "Cada pieza de esta colección combina materiales seleccionados, una construcción cuidada y detalles de producto claros."
                      : "Each piece in this collection combines selected materials, considered construction and clear product details."}
            </p>
          </div>
        </Reveal>
      </section>

    </>
  );
}
