import { COLLECTIONS, CATEGORY_META, type Category, type Product } from "@/data/products";
import { previewCollection } from "@/lib/catalogue-preview-edits";
import { PREVIEW_CATEGORY_OPTIONS } from "@/lib/preview-category-options";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { getLocalizedProduct, t, Locale } from "@/i18n/i18n";
import { isProductForAudience, type ProductAudience } from "@/lib/product-audience";

const UK_CATEGORY_GUIDES: Partial<Record<Category, { heading: string; body: string }>> = {
  "leather-jackets": {
    heading: "Choosing a men's leather jacket",
    body: "Cafe racer jackets offer a clean, close-fitting profile, while leather bomber and flight jackets provide a roomier shape and additional warmth. Classic biker and racing jackets add stronger hardware and panel detailing. Check each product page for its leather type, weight, available colours and size options before ordering.",
  },
  "motorcycle-suits": {
    heading: "One-piece motorcycle leathers for road and track",
    body: "A one-piece leather motorcycle suit should fit closely while allowing a natural riding position. Compare your measurements with the size guide and review the listed armour, stretch panels and construction details. If you are between sizes, contact us before ordering for fit guidance.",
  },
  "leather-bags": {
    heading: "Leather travel bags and motorcycle luggage",
    body: "Choose a leather weekend holdall or backpack for commuting and short trips, or select motorcycle-specific tank bags and saddlebags for secure on-bike storage. Capacity, material and mounting details are listed on every product page to help you compare the available options.",
  },
  accessories: {
    heading: "Choosing leather motorcycle gloves",
    body: "Motorcycle gloves should fit securely without restricting finger movement. Our goatskin riding gloves combine pre-curved fingers, touchscreen-compatible fingertips and carbon-fibre knuckle protection. Use the size guide and review the product specifications before ordering.",
  },
};

export function categoryHead(cat: Category, path: string) {
  const meta = CATEGORY_META[cat];
  const source = PREVIEW_CATEGORY_OPTIONS.find(collection => collection.slug === cat);
  const edit = source ? previewCollection(source) : undefined;
  const edited = edit !== source;
  return {
    meta: [
      { title: (edited && edit?.seoTitle) || `${meta.title} — Tuxar` },
      { name: "description", content: (edited && edit?.metaIntro) || meta.intro },
      { property: "og:title", content: `${meta.title} — Tuxar` },
      { property: "og:description", content: meta.intro },
      { property: "og:url", content: path },
    ],
    links: [{ rel: "canonical", href: path }],
  };
}

export function CategoryView({
  products,
  cat,
  include = [],
  title,
  description,
  locale = "en",
  audience,
}: {
  products: Product[];
  cat: Category;
  include?: Category[];
  title?: string;
  description?: string;
  locale?: string;
  audience?: ProductAudience;
}) {
  const meta = CATEGORY_META[cat];
  const sourceCollection = PREVIEW_CATEGORY_OPTIONS.find(collection => collection.slug === (audience === "women" ? `women-${cat}` : cat));
  const editedCollection = sourceCollection ? previewCollection(sourceCollection) : undefined;
  const hasEdits = editedCollection !== sourceCollection;
  const displayTitle = (hasEdits && editedCollection?.title) || title || meta.title;
  const displayDesc = (hasEdits && editedCollection?.description) || description || meta.intro;

  // Combine primary category with any included categories to filter products
  const targetCategories = [cat, ...include];
  const rawItems = products.filter((p) => targetCategories.includes(p.category) && (!audience || isProductForAudience(p, audience)));

  // Get localized products
  const items = rawItems.map((p) => getLocalizedProduct(p, locale as Locale));
  const ukGuide = locale === "en" ? (cat === "leather-jackets" && audience === "women" ? {
    heading: "Choosing a women's leather jacket",
    body: "Compare cropped, zip-front, belted and hooded silhouettes with your preferred layers and rise of trousers. Review each product's photographs, material details and confirmed measurements before ordering.",
  } : UK_CATEGORY_GUIDES[cat]) : undefined;

  const homeLabel =
    locale === "it"
      ? "Home"
      : locale === "de"
        ? "Startseite"
        : locale === "fr"
          ? "Accueil"
          : locale === "es"
            ? "Inicio"
            : "Home";
  const shopLabel =
    locale === "it"
      ? "Negozio"
      : locale === "de"
        ? "Shop"
        : locale === "fr"
          ? "Boutique"
          : locale === "es"
            ? "Tienda"
            : "Shop";

  return (
    <>
      <PageHero
        repeat
        eyebrow={
          locale === "it"
            ? "Collezione"
            : locale === "de"
              ? "Kollektion"
              : locale === "fr"
                ? "Collection"
                : locale === "es"
                  ? "Colección"
                  : "Collection"
        }
        title={displayTitle}
        description={displayDesc}
        crumbs={[
          { label: homeLabel, to: `/${locale}` },
          { label: shopLabel, to: `/${locale}/shop` },
          { label: displayTitle },
        ]}
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
                    : "pieces"}
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-9 md:gap-x-5 md:gap-y-11">
          {items.map((p, index) => (
            <ProductCard key={p.slug} p={p} priority={index < 4} />
          ))}
        </div>
      </section>
      {ukGuide && (
        <section className="border-t border-border bg-section py-16 md:py-20">
          <Reveal repeat className="container-luxe max-w-3xl">
            <h2 className="font-display text-3xl md:text-4xl">{ukGuide.heading}</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">{ukGuide.body}</p>
          </Reveal>
        </section>
      )}
    </>
  );
}
