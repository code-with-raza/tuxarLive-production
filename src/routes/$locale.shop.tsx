import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod";
import { CATEGORY_META, type Category, type Product } from "@/data/products";
import { ProductCard } from "@/components/site/ProductCard";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { PageHero } from "@/components/site/PageHero";
import { Slider } from "@/components/ui/slider";
import {
  t,
  Locale,
  getLocalizedProduct,
  getLocalizedLink,
  getLocalizedSlug,
} from "@/i18n/i18n";
import { PRODUCTS } from "@/data/products";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const shopSearch = z.object({
  q: z.string().optional(),
  cat: z.enum(["leather-jackets", "motorcycle-suits", "leather-bags", "accessories"]).optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "newest"]).optional(),
});

export const Route = createFileRoute("/$locale/shop")({
  validateSearch: shopSearch,
  loader: () => getStorefrontProducts(),
  head: ({ params, match, loaderData }) => {
    const products = loaderData ?? [];
    const locale = params.locale as Locale;
    const title =
      locale === "en"
        ? "Shop Leather Jackets & Motorcycle Gear UK | Tuxar"
        : `${t("nav.shop", locale)} — Tuxar`;
    const description =
      locale === "en"
        ? "Shop men's leather jackets, motorcycle racing suits, leather gloves, travel bags and motorbike luggage with tracked UK delivery options."
        : t("footer.description", locale);
    const canonicalUrl = absoluteUrl(`/${locale}/shop`);
    const isInternalSearch = Boolean(match.search.q?.trim());
    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(isInternalSearch ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/shop`),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                "@id": `${canonicalUrl}#webpage`,
                name: t("nav.shop", locale),
                description,
                url: canonicalUrl,
                mainEntity: { "@id": `${canonicalUrl}#products` },
              },
              {
                "@type": "ItemList",
                "@id": `${canonicalUrl}#products`,
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
            ],
          }),
        },
      ],
    };
  },
  component: ShopPage,
});

import { useMarketCurrency } from "@/lib/market";
function ShopPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const {formatMoney} = useMarketCurrency(locale);
  const products = Route.useLoaderData() as Product[];
  const { q, cat, sort } = useSearch({ from: "/$locale/shop" });
  const [search, setSearch] = useState(q ?? "");
  const [category, setCategory] = useState<Category | "all">(cat ?? "all");
  const [maxPrice, setMaxPrice] = useState(3000);
  const [sortBy, setSortBy] = useState(sort ?? "featured");

  const filtered = useMemo(() => {
    let list = products.map((p: any) => getLocalizedProduct(p, locale));
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (search)
      list = list.filter((p) =>
        `${p.name} ${p.tagline}`.toLowerCase().includes(search.toLowerCase()),
      );
    list = list.filter((p) => p.priceGBP <= maxPrice);
    if (sortBy === "price-asc") list.sort((a, b) => a.priceGBP - b.priceGBP);
    if (sortBy === "price-desc") list.sort((a, b) => b.priceGBP - a.priceGBP);
    return list;
  }, [search, category, maxPrice, sortBy, locale, products]);

  return (
    <>
      <PageHero
        eyebrow={t("nav.shop", locale)}
        title={
          locale === "it"
            ? "Acquista Tuxar."
            : locale === "de"
              ? "Tuxar kaufen."
              : locale === "fr"
                ? "Acheter Tuxar."
                : locale === "es"
                  ? "Comprar Tuxar."
                  : "Shop Tuxar."
        }
        description={
          locale === "en"
            ? "Men's leather jackets, motorcycle clothing and leather travel goods, with tracked UK delivery options."
            : t("footer.description", locale)
        }
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.shop", locale) },
        ]}
      />
      <section className="container-luxe py-12 md:py-16">
        <div className="grid lg:grid-cols-[260px_1fr] gap-10">
          {/* Filters */}
          <aside className="space-y-8 lg:sticky lg:top-28 self-start">
            <div>
              <label htmlFor="search" className="eyebrow block mb-3">
                {t("search.title", locale)}
              </label>
              <input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  locale === "it"
                    ? "Cerca nell'atelier..."
                    : locale === "de"
                      ? "Im Atelier suchen..."
                      : locale === "fr"
                        ? "Rechercher dans l'atelier..."
                        : locale === "es"
                          ? "Buscar en el taller..."
                          : "Search the atelier…"
                }
                className="w-full h-11 border border-border bg-background px-3 text-sm focus:outline-none focus:border-foreground"
              />
            </div>
            <div>
              <div className="eyebrow mb-3">
                {locale === "it"
                  ? "Categoria"
                  : locale === "de"
                    ? "Kategorie"
                    : locale === "fr"
                      ? "Catégorie"
                      : locale === "es"
                        ? "Categoría"
                        : "Category"}
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => setCategory("all")}
                    className={`text-left ${category === "all" ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {locale === "it"
                      ? "Tutti"
                      : locale === "de"
                        ? "Alle"
                        : locale === "fr"
                          ? "Tout"
                          : locale === "es"
                            ? "Todos"
                            : "All"}{" "}
                    ({products.length})
                  </button>
                </li>
                {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => setCategory(c)}
                      className={`text-left ${category === c ? "font-medium" : "text-muted-foreground"} hover:text-foreground`}
                    >
                      {t(`categories.${c}`, locale)} (
                      {products.filter((p) => p.category === c).length})
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow mb-3">
                {locale === "it"
                  ? "Prezzo"
                  : locale === "de"
                    ? "Preis"
                    : locale === "fr"
                      ? "Prix"
                      : locale === "es"
                        ? "Precio"
                        : "Price"}{" "}
                ·{" "}
                {locale === "it"
                  ? "fino a"
                  : locale === "de"
                    ? "bis"
                    : locale === "fr"
                      ? "jusqu'à"
                      : locale === "es"
                        ? "hasta"
                        : "up to"}{" "}
                {formatMoney(maxPrice)}
              </div>
              <Slider
                value={[maxPrice]}
                onValueChange={(v) => setMaxPrice(v[0])}
                min={200}
                max={3000}
                step={50}
              />
            </div>
            <div>
              <label htmlFor="shop-sort" className="eyebrow mb-3 block">
                {locale === "it"
                  ? "Ordina"
                  : locale === "de"
                    ? "Sortieren"
                    : locale === "fr"
                      ? "Trier"
                      : locale === "es"
                        ? "Ordenar"
                        : "Sort"}
              </label>
              <select
                id="shop-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full h-11 border border-border bg-background px-3 text-sm focus:outline-none focus:border-foreground"
              >
                <option value="featured">
                  {locale === "it"
                    ? "In evidenza"
                    : locale === "de"
                      ? "Empfohlen"
                      : locale === "fr"
                        ? "En vedette"
                        : locale === "es"
                          ? "Destacados"
                          : "Featured"}
                </option>
                <option value="price-asc">
                  {locale === "it"
                    ? "Prezzo: dal più basso"
                    : locale === "de"
                      ? "Preis: niedrig bis hoch"
                      : locale === "fr"
                        ? "Prix : du moins cher"
                        : locale === "es"
                          ? "Precio: de menor a mayor"
                          : "Price · Low to High"}
                </option>
                <option value="price-desc">
                  {locale === "it"
                    ? "Prezzo: dal più alto"
                    : locale === "de"
                      ? "Preis: hoch bis niedrig"
                      : locale === "fr"
                        ? "Prix : du plus cher"
                        : locale === "es"
                          ? "Precio: de mayor a menor"
                          : "Price · High to Low"}
                </option>
                <option value="newest">
                  {locale === "it"
                    ? "Novità"
                    : locale === "de"
                      ? "Neueste"
                      : locale === "fr"
                        ? "Nouveautés"
                        : locale === "es"
                          ? "Novedades"
                          : "Newest"}
                </option>
              </select>
            </div>
          </aside>

          {/* Grid */}
          <div>
            <div className="flex items-center justify-between mb-8 text-sm text-muted-foreground">
              <span>
                {filtered.length}{" "}
                {filtered.length === 1
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
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="py-20 text-center text-muted-foreground">
                {locale === "it"
                  ? "Nessun articolo corrisponde ai filtri."
                  : locale === "de"
                    ? "Keine Artikel entsprechen diesen Filtern."
                    : locale === "fr"
                      ? "Aucun article ne correspond à ces filtres."
                      : locale === "es"
                        ? "Ningún artículo coincide con estos filtros."
                        : "No pieces match those filters."}{" "}
                <button
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setMaxPrice(3000);
                  }}
                  className="underline"
                >
                  {locale === "it"
                    ? "Ripristina"
                    : locale === "de"
                      ? "Zurücksetzen"
                      : locale === "fr"
                        ? "Réinitialiser"
                        : locale === "es"
                          ? "Restablecer"
                          : "Reset"}
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-9 md:gap-x-5 md:gap-y-11">
                {filtered.map((p,index) => (
                  <ProductCard key={p.slug} p={p} priority={index < 4} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
