import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryView } from "@/components/site/CategoryView";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const LOCALIZED_DESC = {
  en: "Shop men's leather holdalls, backpacks and motorcycle luggage in the UK, including tank bags and waterproof saddlebags with free UK delivery.",
  it: "Pelli conciate al vegetale che invecchiano creando una patina viva. Bordi bruniti a mano, accessori in ottone massiccio, riparazione a vita.",
  de: "Pflanzlich gegerbte Häute, die zu einer lebendigen Patina reifen. Von Hand polierte Kanten, massive Messingbeschläge, lebenslange Reparatur.",
  fr: "Peaux tannées au végétal vieillies avec une patine vivante. Bords brunis à la main, quincaillerie en laiton massif, réparation à vie.",
  es: "Pieles de curtido vegetal envejecidas con una pátina viva. Bordes bruñidos a mano, herrajes de latón macizo, reparación de por vida.",
};

export const Route = createFileRoute("/$locale/leather-bags")({
  loader: () => getStorefrontProducts(),
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title =
      locale === "en"
        ? "Leather Bags & Motorcycle Luggage UK | Tuxar"
        : `${t("nav.bags", locale)} — Tuxar`;
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    const canonicalUrl = absoluteUrl(`/${locale}/leather-bags`);
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
        ...localizedAlternates((targetLocale) => `/${targetLocale}/leather-bags`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };
    const title = t("nav.bags", locale);
    const description = LOCALIZED_DESC[locale] || LOCALIZED_DESC.en;
    return (
      <CategoryView products={Route.useLoaderData()} cat="leather-bags" title={title} description={description} locale={locale} />
    );
  },
});
