import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useShop } from "@/store/shop";
import { type Product } from "@/data/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { t, Locale, getLocalizedProduct, getLocalizedLink } from "@/i18n/i18n";

export const Route = createFileRoute("/$locale/wishlist")({
  loader: () => getStorefrontProducts(),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${
      locale === "it"
        ? "La tua lista dei desideri"
        : locale === "de"
          ? "Wunschliste"
          : locale === "fr"
            ? "Votre Liste d'envies"
            : locale === "es"
              ? "Tu lista de deseos"
              : "Your Wishlist"
    } — Tuxar`;
    return {
      meta: [{ title }, { name: "robots", content: "noindex" }],
    };
  },
  component: WishlistPage,
});

function WishlistPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const wishlist = useShop((s) => s.wishlist);
  const products = Route.useLoaderData() as Product[];
  const rawItems = products.filter((p) => wishlist.includes(p.slug));
  const items = rawItems.map((p) => getLocalizedProduct(p, locale));

  const shopLink = getLocalizedLink("/shop", locale);

  const eyebrow =
    locale === "it"
      ? "Salvato"
      : locale === "de"
        ? "Gespeichert"
        : locale === "fr"
          ? "Enregistré"
          : locale === "es"
            ? "Guardado"
            : "Saved";

  const emptyTitle =
    locale === "it"
      ? "La tua lista dei desideri è vuota."
      : locale === "de"
        ? "Ihre Wunschliste ist leer."
        : locale === "fr"
          ? "Votre liste d'envies est vide."
          : locale === "es"
            ? "Tu lista de deseos está vacía."
            : "Your wishlist is empty.";

  const filledTitle =
    items.length === 1
      ? locale === "it"
        ? "1 articolo salvato."
        : locale === "de"
          ? "1 gespeicherter Artikel."
          : locale === "fr"
            ? "1 article enregistré."
            : locale === "es"
              ? "1 artículo guardado."
              : "1 saved piece."
      : locale === "it"
        ? `${items.length} articoli salvati.`
        : locale === "de"
          ? `${items.length} gespeicherte Artikel.`
          : locale === "fr"
            ? `${items.length} articles enregistrés.`
            : locale === "es"
              ? `${items.length} artículos guardados.`
              : `${items.length} saved pieces.`;

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={items.length ? filledTitle : emptyTitle}
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          {
            label:
              locale === "it"
                ? "Lista desideri"
                : locale === "de"
                  ? "Wunschliste"
                  : locale === "fr"
                    ? "Liste d'envies"
                    : locale === "es"
                      ? "Lista de deseos"
                      : "Wishlist",
          },
        ]}
      />
      <section className="container-luxe py-12">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-6">
              {locale === "it"
                ? "Tocca il cuore su qualsiasi articolo per salvarlo per dopo."
                : locale === "de"
                  ? "Tippen Sie auf das Herz bei einem beliebigen Artikel, um ihn für später zu speichern."
                  : locale === "fr"
                    ? "Appuyez sur le cœur d'un article pour l'enregistrer pour plus tard."
                    : locale === "es"
                      ? "Toque el corazón en cualquier artículo para guardarlo para más tarde."
                      : "Tap the heart on any piece to save it for later."}
            </p>
            <Link
              to={shopLink.to}
              params={shopLink.params}
              className="inline-flex h-12 items-center bg-foreground text-background px-7 text-sm tracking-widest uppercase"
            >
              {locale === "it"
                ? "Esplora la collezione"
                : locale === "de"
                  ? "Kollektion entdecken"
                  : locale === "fr"
                    ? "Découvrir la collection"
                    : locale === "es"
                      ? "Explorar la colección"
                      : "Explore the collection"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 md:gap-x-6">
            {items.map((p) => (
              <ProductCard key={p.slug} p={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
