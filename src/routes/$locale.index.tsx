import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Truck, Wrench, Award } from "lucide-react";
import { t, Locale, getLocalizedProduct, getLocalizedLink } from "@/i18n/i18n";

import { getProductAsset } from "@/assets";

import { ProductCard } from "@/components/site/ProductCard";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { SectionHeader } from "@/components/site/SectionHeader";
import { Reveal } from "@/components/site/Reveal";
import { HeroSlider } from "@/components/site/HeroSlider";
import { PRODUCTS, type Product } from "@/data/products";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { cloudinaryUrl, bagImageUrl } from "@/lib/cloudinary";
import { campaignImageSources } from "@/lib/homepage-campaign";
import { getHomepageSlides } from "@/lib/homepage-slides-query";
import { isOriginalHomepagePhoto, type HomepageSlideRow } from "@/lib/homepage-slides";
import { heroImageSources } from "@/lib/hero-image";

function tileImageSources(url: string) {
  return [360, 640, 900].map(width => `${cloudinaryUrl(url, { width, height: Math.round(width * 4 / 3), crop: "fill" })} ${width}w`).join(", ");
}

const heroImg = getProductAsset("/src/assets/banners/hero-main.webp");
const catBags = getProductAsset("/src/assets/cat-bags.webp");
const catSuits = getProductAsset("/src/assets/cat-suits.webp");
const catAccessories = getProductAsset("/src/assets/cat-accessories.webp");
const jacket1 = getProductAsset("/src/assets/p-jacket-1.webp");

export const Route = createFileRoute("/$locale/")({
  loader: async ({params}) => { const [products,banners]=await Promise.all([getStorefrontProducts(),getHomepageSlides(params.locale)]);return {products,banners}; },
  head: ({ params, loaderData }) => {
    const locale = params.locale as Locale;
    const title =
      locale === "en"
        ? "Tuxar | Men's Leather Jackets, Bags & Motorcycle Gear"
        : `${t("home.hero.title", locale)} — Tuxar`;
    const description = t("footer.description", locale);
    const canonicalUrl = absoluteUrl(`/${locale}`);
    const firstBanner=loaderData?.banners?.[0];
    const socialImage = absoluteUrl(firstBanner?.image_url??'/favicon.svg');
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: socialImage },
        { property: "og:image:alt", content: "Tuxar leather atelier campaign" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: socialImage },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        ...localizedAlternates((targetLocale) => `/${targetLocale}`),
        ...(firstBanner?[{ rel: "preload", as: "image", href: cloudinaryUrl(firstBanner.image_url,isOriginalHomepagePhoto(firstBanner)?{width:1280,height:900,crop:'fill'}:{width:1280,crop:'fit'}),imageSrcSet:isOriginalHomepagePhoto(firstBanner)?heroImageSources(firstBanner.image_url):campaignImageSources(firstBanner.image_url),imageSizes:'100vw',fetchPriority:'high' as const}]:[]),
      ],
    };
  },
  component: Home,
});

function Home() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { products,banners } = Route.useLoaderData() as { products: Product[];banners:HomepageSlideRow[] };

  // Localize products
  const localizedProducts = products.map((p) => getLocalizedProduct(p, locale));

  const featuredProducts = localizedProducts.slice(0, 4);
  const newArrivals = localizedProducts
    .filter((p: any) => p.badge === "New" || !p.badge)
    .slice(0, 4);
  const featuredBagSlugs = [
    "brown-minimal-zip-backpack",
    "brown-buckle-pocket-travel-bag",
    "brown-drawstring-buckle-rucksack",
    "dark-brown-barrel-duffel",
  ];
  const bagRank = (slug: string) => {
    const index = featuredBagSlugs.indexOf(slug);
    return index === -1 ? featuredBagSlugs.length : index;
  };
  const bagsLine = localizedProducts
    .filter((p) => p.category === "leather-bags")
    .sort((a, b) => bagRank(a.slug) - bagRank(b.slug))
    .slice(0, 4);

  return (
    <>
      <HeroSlider locale={locale} initialSlides={banners} />
      {banners.length===0&&<h1 className="sr-only">{t('home.hero.title',locale)}</h1>}

      {/* FEATURED CATEGORIES */}
      <section className="container-luxe py-20 md:py-28">
        <SectionHeader
          repeat
          eyebrow={t("home.categories.eyebrow", locale)}
          title={t("home.categories.title", locale)}
          link={{ ...getLocalizedLink("/shop", locale), label: t("nav.shop", locale) }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {(["leather-jackets", "motorcycle-suits", "leather-bags", "accessories"] as const).map(
            (cat, index) => {
              const img =
                cat === "leather-jackets"
                  ? jacket1
                  : cat === "motorcycle-suits"
                    ? catSuits
                    : cat === "leather-bags"
                      ? catBags
                      : catAccessories;
              return (
                <Reveal key={cat} repeat delay={index * 0.07} distance={18} amount={0.08}>
                  <Link
                    {...getLocalizedLink(`/${cat}`, locale)}
                    className="luxe-category-card group relative overflow-hidden aspect-[3/4] bg-section"
                  >
                    <img
                      src={cloudinaryUrl(img, { width: 640, height: 853, crop: "fill" })}
                      srcSet={tileImageSources(img)}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      alt={t(`nav.${cat.replace("leather-", "")}`, locale)}
                      loading="lazy"
                      width={1200}
                      height={1500}
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-7 text-background">
                      <h3 className="luxe-category-title font-display text-xl md:text-2xl">
                        {t(`nav.${cat.replace("leather-", "")}`, locale)}
                      </h3>
                      <span className="luxe-category-cta mt-1 text-[11px] tracking-widest uppercase opacity-80 inline-flex items-center gap-1">
                        {t("home.hero.atelier", locale)}{" "}
                        <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            },
          )}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-surface py-20 md:py-28">
        <div className="container-luxe">
          <SectionHeader
            repeat
            eyebrow={t("home.bestsellers", locale)}
            title={t("home.bestsellers_sub", locale)}
            link={{ ...getLocalizedLink("/shop", locale), label: t("nav.shop", locale) }}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 md:gap-x-6">
            {featuredProducts.map((p) => (
              <ProductCard key={p.slug} p={p} repeat />
            ))}
          </div>
        </div>
      </section>

      {/* WHY TUXAR */}
      <section className="container-luxe py-20 md:py-28">
        <SectionHeader
          repeat
          align="center"
          eyebrow="Tuxar"
          title={t("home.why_tuxar.title", locale)}
          description={t("home.why_tuxar.subtitle", locale)}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 md:gap-y-16 gap-x-6 mt-4">
          {[
            {
              icon: Award,
              t: t("home.why_tuxar.fg", locale),
              d: t("home.why_tuxar.fg_desc", locale),
            },
            {
              icon: Wrench,
              t: t("home.why_tuxar.repair", locale),
              d: t("home.why_tuxar.repair_desc", locale),
            },
            {
              icon: Truck,
              t: t("home.why_tuxar.shipping", locale),
              d: t("home.why_tuxar.shipping_desc", locale),
            },
            {
              icon: ShieldCheck,
              t: t("home.why_tuxar.returns", locale),
              d: t("home.why_tuxar.returns_desc", locale),
            },
          ].map((f, i) => (
            <Reveal key={f.t} repeat delay={i * 0.07} className="text-center" distance={16}>
              <f.icon className="h-7 w-7 mx-auto text-foreground/80" strokeWidth={1.2} />
              <div className="mt-4 font-display text-lg">{f.t}</div>
              <p className="mt-2 text-sm text-muted-foreground max-w-[22ch] mx-auto">{f.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* MOTORCYCLE COLLECTION SHOWCASE */}
      <section className="relative bg-foreground text-background py-20 md:py-32 overflow-hidden">
        <img
          src={cloudinaryUrl(catSuits, { width: 1280, height: 720, crop: "fill" })}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/70 to-transparent" />
        <div className="relative container-luxe grid md:grid-cols-2 gap-10 items-center">
          <Reveal repeat className="max-w-lg">
            <div className="eyebrow text-background/60 mb-4">{t("home.suits.eyebrow", locale)}</div>
            <h2 className="font-display text-4xl md:text-6xl leading-[1.05]">
              {t("home.suits.title", locale)}
            </h2>
            <p className="mt-6 text-background/75 leading-relaxed">
              {t("home.suits.desc", locale)}
            </p>
            <Link
              {...getLocalizedLink("/motorcycle-suits", locale)}
              className="luxe-button mt-8 inline-flex h-12 items-center gap-2 bg-background px-7 text-sm tracking-widest uppercase text-foreground"
            >
              {t("home.suits.cta", locale)}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* LEATHER BAGS SHOWCASE */}
      <section className="container-luxe py-20 md:py-28">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <Reveal repeat className="luxe-media-reveal md:col-span-7 relative aspect-[4/3] overflow-hidden bg-section order-2 md:order-1">
            <img
              src={cloudinaryUrl(catBags, { width: 640, height: 853, crop: "fill" })}
              srcSet={tileImageSources(catBags)}
              sizes="(min-width: 768px) 50vw, 100vw"
              alt="Tuxar leather bags"
              loading="lazy"
              width={1200}
              height={1500}
              className="h-full w-full object-cover"
            />
          </Reveal>
          <Reveal repeat className="md:col-span-5 order-1 md:order-2" delay={0.08}>
            <div className="eyebrow mb-4">{t("home.bags.eyebrow", locale)}</div>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">
              {t("home.bags.title", locale)}
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              {t("home.bags.desc", locale)}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {bagsLine.map((p) => (
                <Link
                  key={p.slug}
                  {...getLocalizedLink(`/product/${p.slug}`, locale)}
                  className="block group"
                >
                  <div className="aspect-square overflow-hidden bg-section">
                    <img
                      src={bagImageUrl(p.image, 640, 640)}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-3 text-sm font-display">{p.name}</p>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* BRAND STORY */}
      <section className="container-luxe py-20 md:py-32">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <Reveal repeat className="luxe-media-reveal md:col-span-6 relative aspect-[4/5] md:aspect-[3/4] overflow-hidden">
            <img
              src={cloudinaryUrl(getProductAsset("/blog_images/cognac_leather.webp"), { width: 800 })}
              alt="Tuxar atelier craftsman"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </Reveal>
          <Reveal repeat className="md:col-span-6 md:pl-8" delay={0.08}>
            <div className="eyebrow mb-4">{t("home.atelier.eyebrow", locale)}</div>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">
              {t("home.atelier.title", locale)}
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              {t("home.atelier.desc", locale)}
            </p>
            <Link
              {...getLocalizedLink("/about", locale)}
              className="mt-8 inline-flex items-center gap-2 text-sm tracking-widest uppercase border-b border-foreground pb-1"
            >
              {t("home.atelier.cta", locale)} <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* NEW ARRIVALS */}
      <section className="bg-surface py-20 md:py-28">
        <div className="container-luxe">
          <SectionHeader
            repeat
            eyebrow={t("home.new_arrivals", locale)}
            title={t("home.new_arrivals_sub", locale)}
            link={{ ...getLocalizedLink("/shop", locale), label: t("nav.shop", locale) }}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 md:gap-x-6">
            {newArrivals.map((p) => (
              <ProductCard key={p.slug} p={p} repeat />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
