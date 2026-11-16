import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryView } from "@/components/site/CategoryView";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const LOCALIZED_DESC = {
  en: "Shop one-piece motorcycle leather suits with pre-curved track fits and flexible movement panels.",
  it: "Scopri tute da moto in pelle intere con vestibilità precurvata e pannelli flessibili per il movimento.",
  de: "Entdecken Sie einteilige Motorrad-Lederkombis mit vorgeformter Passform und flexiblen Bewegungseinsätzen.",
  fr: "Découvrez des combinaisons moto en cuir une pièce avec coupe pré-courbée et panneaux souples.",
  es: "Descubre monos de moto de cuero de una pieza con ajuste precurvado y paneles flexibles.",
};

export const Route = createFileRoute("/$locale/motorcycle-suits")({
  loader: () => getStorefrontProducts(),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title =
      locale === "en"
        ? "Motorcycle Leather Suits UK | Tuxar"
        : `${t("nav.suits", locale)} — Tuxar`;
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    const canonicalUrl = absoluteUrl(`/${locale}/motorcycle-suits`);
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
        ...localizedAlternates((targetLocale) => `/${targetLocale}/motorcycle-suits`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };
    const title = t("nav.suits", locale);
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    return (
      <CategoryView products={Route.useLoaderData()}
        cat="motorcycle-suits"
        title={title}
        description={description}
        locale={locale}
      />
    );
  },
});
