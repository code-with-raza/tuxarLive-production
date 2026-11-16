import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryView } from "@/components/site/CategoryView";
import { PRODUCTS, COLLECTIONS } from "@/data/products";
import { previewCollection } from "@/lib/catalogue-preview-edits";
import { isProductForAudience } from "@/lib/product-audience";
import { CATEGORY_CHILDREN } from "@/lib/catalogCategories";
import { type Locale } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const titles: Record<Locale, string> = {
  en: "Women's Leather Jackets", it: "Giacche di pelle da donna", de: "Damen-Lederjacken",
  fr: "Vestes en cuir pour femme", es: "Chaquetas de cuero para mujer",
};
const descriptions: Record<Locale, string> = {
  en: "Explore women's leather jackets at Tuxar, including cropped, belted, zip-front and hooded designs. Compare colours and product photographs.",
  it: "Scopri le giacche di pelle da donna Tuxar: modelli corti, con cintura, zip e cappuccio. Confronta colori e fotografie.",
  de: "Entdecken Sie Damen-Lederjacken von Tuxar: kurze Modelle, Gürteljacken und Designs mit Reißverschluss oder Kapuze. Vergleichen Sie Farben und Fotos.",
  fr: "Découvrez les vestes en cuir pour femme Tuxar : coupes courtes, ceinturées, zippées et à capuche. Comparez les couleurs et les photos.",
  es: "Descubre chaquetas de cuero para mujer Tuxar: cortas, con cinturón, cremallera y capucha. Compara colores y fotografías.",
};
export const Route = createFileRoute("/$locale/women-leather-jackets")({
  loader: () => getStorefrontProducts(),
  head: ({ params, loaderData }) => {
    const locale = params.locale as Locale;
    const url = absoluteUrl(`/${locale}/women-leather-jackets`);
    const source = COLLECTIONS.find(collection => collection.slug === "women-leather-jackets");
    const edit = source ? previewCollection(source) : undefined;
    const edited = edit !== source;
    const populated = (loaderData ?? []).some(product => CATEGORY_CHILDREN['leather-jackets'].includes(product.category) && isProductForAudience(product, 'women'));
    return {
      meta: [{ title: (edited && edit?.seoTitle) || `${titles[locale]} | Tuxar` }, { name: "description", content: (edited && edit?.metaIntro) || descriptions[locale] },
        { property: "og:title", content: titles[locale] }, { property: "og:description", content: descriptions[locale] }, { property: "og:url", content: url },
        ...(!populated ? [{ name: "robots", content: "noindex, follow" }] : [])],
      links: [{ rel: "canonical", href: url }, ...localizedAlternates(target => `/${target}/women-leather-jackets`)],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };
    return <CategoryView products={Route.useLoaderData()} cat="leather-jackets" include={["classic", "bomber", "racing", "varsity", "flight_jacket"]}
      audience="women" title={titles[locale]} description={descriptions[locale]} locale={locale} />;
  },
});
