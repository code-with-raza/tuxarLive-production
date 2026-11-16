import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryView } from "@/components/site/CategoryView";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const LOCALIZED_DESC = {
  en: "Shop leather motorcycle gloves with reinforced knuckles, pre-curved fingers and tracked UK delivery options.",
  it: "Guanti, portafogli, cinture e piccola pelletteria — i tocchi finali.",
  de: "Handschuhe, Brieftaschen, Gürtel und kleine Lederwaren — die letzten Details.",
  fr: "Gants, portefeuilles, ceintures et petite maroquinerie — les touches finales.",
  es: "Guantes, carteras, cinturones y pequeños artículos de cuero — los toques finales.",
};

export const Route = createFileRoute("/$locale/accessories")({
  loader: () => getStorefrontProducts(),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title =
      locale === "en"
        ? "Leather Motorcycle Gloves UK | Tuxar"
        : `${t("nav.accessories", locale)} — Tuxar`;
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    const canonicalUrl = absoluteUrl(`/${locale}/accessories`);
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
        ...localizedAlternates((targetLocale) => `/${targetLocale}/accessories`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };
    const title = t("nav.accessories", locale);
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    return (
      <CategoryView products={Route.useLoaderData()} cat="accessories" title={title} description={description} locale={locale} />
    );
  },
});
