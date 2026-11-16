import { Product, Category, CATEGORY_META, Collection, COLLECTIONS } from "./product-types";
import { JACKET_PRODUCTS } from "./products/jackets";
import { SUIT_PRODUCTS } from "./products/suits";
import { BAG_PRODUCTS } from "./products/bags";
import { ACCESSORY_PRODUCTS } from "./products/accessories";
import { LOCAL_JACKET_PRODUCTS } from "@/lib/local-catalogue";
import approvedCatalogue from "./products/approved-catalogue.json";
import approvedWomensCatalogue from "./products/approved-womens-catalogue.json";
import approvedBagsCatalogue from "./products/approved-bags-catalogue.json";
import deploymentCatalogue from "./products/deployment-catalogue.json";

export { CATEGORY_META, COLLECTIONS };
export type { Category, Product, Collection };

export const PRODUCTS: Product[] = [
  ...LOCAL_JACKET_PRODUCTS,
  ...([...approvedCatalogue.products, ...approvedWomensCatalogue.products, ...approvedBagsCatalogue.products] as Product[]).filter(
    (product) => !LOCAL_JACKET_PRODUCTS.some((draft) => draft.slug === product.slug),
  ),
  ...JACKET_PRODUCTS,
  ...SUIT_PRODUCTS,
  ...BAG_PRODUCTS,
  ...ACCESSORY_PRODUCTS,
].filter(product => !(deploymentCatalogue?.products as Product[] | undefined)?.some(incoming => incoming.slug === product.slug))
  .concat((deploymentCatalogue?.products ?? []) as Product[])
  .map(product => ({ ...product, ...((deploymentCatalogue?.overrides ?? {}) as Record<string, Partial<Product>>)[product.slug] }));

export const getProductBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

export const getProductsByCategory = (cat: Category) => PRODUCTS.filter((p) => p.category === cat);

/** UK-first storefront currency formatter. */
export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
