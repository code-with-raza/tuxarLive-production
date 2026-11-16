import { CATEGORY_META, COLLECTIONS, type Collection, type Product } from "@/data/products";
import { categoryIncludes } from "@/lib/catalogCategories";
import { collectionAudience, isProductForAudience } from "@/lib/product-audience";

// These two main category pages do not have a built-in collection record.
export const PREVIEW_CATEGORY_OPTIONS: Collection[] = [
  ...COLLECTIONS,
  ...(["leather-jackets", "accessories"] as const)
    .filter((slug) => !COLLECTIONS.some((collection) => collection.slug === slug))
    .map((slug) => ({
      slug,
      title: CATEGORY_META[slug].title,
      description: CATEGORY_META[slug].intro,
      metaIntro: CATEGORY_META[slug].intro,
      image: CATEGORY_META[slug].image,
      seoContent: CATEGORY_META[slug].intro,
    })),
];
export function productsInPreviewCategory(collection: Collection, products: Product[]) {
  return products.filter(
    (product) =>
      isProductForAudience(product, collectionAudience(collection.slug)!) &&
      (product.collections?.includes(collection.slug) ||
        product.collections?.includes(collection.sourceCollection ?? collection.slug) ||
        (["leather-jackets", "accessories"].includes(collection.slug) &&
          categoryIncludes(collection.slug, product.category))),
  );
}
