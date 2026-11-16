import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/site/PageHero";
import { ProductCard } from "@/components/site/ProductCard";
import { COLLECTIONS, PRODUCTS, CATEGORY_META, type Category, type Product } from "@/data/products";
import { getLocalizedCollection, getLocalizedSlug, resolveSlug, type Locale } from "@/i18n/i18n";
import { absoluteUrl } from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { CATEGORY_CHILDREN } from "@/lib/catalogCategories";
import { LOCAL_JACKET_PRODUCTS } from "@/lib/local-catalogue";
import { getAudienceCollection, isProductForAudience } from "@/lib/product-audience";
import { previewCollection } from "@/lib/catalogue-preview-edits";
export const Route = createFileRoute("/$locale/$category")({
  beforeLoad: ({ params }) => {
    // Old women's direct category links lead to the same canonical collection.
    const locale = params.locale as Locale;
    const id = resolveSlug(params.category, "collection", locale);
    const currentSlug = getLocalizedSlug(id, "collection", locale);
    if (id.startsWith("women-") && (id !== currentSlug || id !== params.category)) throw redirect({
      to: "/$locale/collections/$slug", params: { locale, slug: currentSlug },
      search: true, replace: true, statusCode: 301,
    });
  },
  validateSearch: (search: Record<string, unknown>): { audience?: "men" | "women" } => ({
    audience: search.audience === "women" || search.audience === "men" ? search.audience : undefined,
  }),
  head: ({ params, match }) => {
    const locale = params.locale as Locale;
    const audience = match.search.audience ?? (params.category.startsWith("women-") ? "women" : "men");
    const fallbackTitle = CATEGORY_META[params.category as Category]?.title ?? params.category.replace(/[-_]/g, " ").replace(/\b\w/g, character => character.toUpperCase());
    const raw = getAudienceCollection(params.category, fallbackTitle, audience, COLLECTIONS);
    const collection = raw ? getLocalizedCollection(raw, locale) : undefined;
    const title = collection?.seoTitle || `${collection?.title ?? fallbackTitle} | Tuxar`;
    const description = collection?.metaIntro || `Browse ${fallbackTitle.toLowerCase()} at Tuxar. Explore product photographs, descriptions and available options.`;
    const canonical = absoluteUrl(collection ? `/${locale}/collections/${getLocalizedSlug(collection.slug, "collection", locale)}` : `/${locale}/${params.category}`);
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        ...(raw?.comingSoon ? [{ name: "robots", content: "noindex, follow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: DynamicCategory,
});
function DynamicCategory() {
  const { locale, category } = Route.useParams();
  const { audience } = Route.useSearch();
  const [record, setRecord] = useState<any>(),
    [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("*,hero:media_assets!product_categories_hero_media_id_fkey(secure_url,alt_text)")
        .eq("slug", category)
        .eq("status", "active")
        .maybeSingle();
      setRecord(cat);
      if (cat) {
        const inferredAudience = audience ?? (cat.audience === "women" || category.startsWith("women-") || /^women(?:'s)?\s/i.test(cat.name) ? "women" : "men");
        const matchedCollection = getAudienceCollection(category, cat.name, inferredAudience, COLLECTIONS);
        const draftCollection = matchedCollection ? previewCollection(matchedCollection) : undefined;
        if (draftCollection && (draftCollection !== matchedCollection || ["women-aviator-jackets", "women-varsity-jackets", "women-racing-jackets", "women-shearling-jackets", "women-puffer-jackets"].includes(draftCollection.slug))) {
          setRecord({ ...cat, name: draftCollection.title, description: draftCollection.description });
        }
        const { data } = await supabase
          .from("products")
          .select(
            "*,product_images(url,position),product_variants(size,color,color_hex,stock,active)",
          )
          .in("category", CATEGORY_CHILDREN[category] ?? [category])
          .eq("status", "active");
        setProducts(
          [...LOCAL_JACKET_PRODUCTS.filter((draft) => (CATEGORY_CHILDREN[category] ?? [category]).includes(draft.category)
            || draft.collections?.includes(draftCollection?.slug ?? category)
            || (draftCollection?.sourceCollection && draft.collections?.includes(draftCollection.sourceCollection))), ...(data ?? []).map((r: any) => {
            const base = PRODUCTS.find((p) => p.slug === r.slug);
            const images = (r.product_images ?? [])
              .sort((a: any, b: any) => a.position - b.position)
              .map((i: any) => i.url);
            const variants = (r.product_variants ?? []).filter((v: any) => v.active);
            return {
              ...(base ?? {}),
              slug: r.slug,
              name: r.name,
              tagline: r.tagline,
              description: r.description,
              category: r.category,
              priceGBP: r.price_pence / 100,
              comparePriceGBP: r.compare_price_pence ? r.compare_price_pence / 100 : undefined,
              currency: "GBP",
              image: base?.image ?? images[0] ?? "",
              gallery: base?.gallery?.length ? base.gallery : images,
              colors: [
                ...new Map(
                  variants.map((v: any) => [v.color, { name: v.color, hex: v.color_hex }]),
                ).values(),
              ],
              sizes: [...new Set(variants.map((v: any) => v.size))],
              material: r.material,
              weight: r.weight,
              specs: base?.specs ?? [],
              rating: base?.rating ?? 0,
              reviewCount: base?.reviewCount ?? 0,
              inStock: variants.some((v: any) => v.stock > 0),
            } as Product;
          })].filter((product) => isProductForAudience(product, inferredAudience)),
        );
      }
      setLoading(false);
    })();
  }, [category, audience]);
  if (loading)
    return <div className="min-h-[55vh] grid place-items-center">Loading collection…</div>;
  if (!record)
    return (
      <div className="container-luxe py-32 text-center">
        <p className="text-xs tracking-widest">404</p>
        <h1 className="font-display text-5xl mt-4">Category not found</h1>
      </div>
    );
  return (
    <>
      {record.show_hero && (
        <PageHero
          eyebrow="Collection"
          title={record.name}
          description={record.show_description ? record.description : undefined}
          image={
            record.hero?.secure_url
              ? cloudinaryUrl(record.hero.secure_url, { width: 1920, height: 840, crop: "fill" })
              : undefined
          }
          imageAlt={record.hero?.alt_text}
          crumbs={[
            { label: "Home", to: `/${locale}` },
            { label: "Shop", to: `/${locale}/shop` },
            { label: record.name },
          ]}
        />
      )}
      <section className="container-luxe py-12 md:py-16">
        {record.show_product_count && (
          <p className="mb-6 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
        )}
        {record.show_filters && (
          <div className="mb-8 border-b pb-4 text-xs uppercase tracking-widest">
            Showing all products
          </div>
        )}
        {products.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p,index) => (
              <ProductCard key={p.slug} p={p} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed py-20 text-center text-muted-foreground">
            No active products are assigned to this category yet.
          </div>
        )}
      </section>
    </>
  );
}
