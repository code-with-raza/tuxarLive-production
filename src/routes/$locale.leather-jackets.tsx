import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryView, categoryHead } from "@/components/site/CategoryView";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const LOCALIZED_DESC = {
  en: "Shop men's leather jackets in cafe racer, bomber, flight and classic styles. Compare materials, colours and sizes with delivery to the UK and Europe.",
  it: "Pelle pieno fiore selezionata e rifinita con cura, con una vestibilità scolpita come una seconda pelle.",
  de: "Entdecken Sie Herren-Lederjacken im Café-Racer-, Bomber-, Flieger- und klassischen Stil. Vergleichen Sie Materialien, Farben und Größen vor der Bestellung.",
  fr: "Cuir pleine fleur sélectionné et soigneusement fini, avec une coupe ajustée et sculptée.",
  es: "Cuero de grano completo seleccionado y cuidadosamente acabado, con un ajuste esculpido.",
};

export const Route = createFileRoute("/$locale/leather-jackets")({
  loader: () => getStorefrontProducts(),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title =
      locale === "en" ? "Men's Leather Jackets UK | Tuxar" : `${t("nav.jackets", locale)} — Tuxar`;
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    const canonicalUrl = absoluteUrl(`/${locale}/leather-jackets`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/leather-jackets`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };
    const title = locale === "en" ? "Men's Leather Jackets" : t("nav.jackets", locale);
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    return (
      <CategoryView products={Route.useLoaderData()}
        cat="leather-jackets"
        audience="men"
        include={["classic", "bomber", "racing", "varsity", "flight_jacket"]}
        title={title}
        description={description}
        locale={locale}
      />
    );
  },
});
