import catalogue from "@/data/products/local-jackets.json";
import womensCatalogue from "@/data/products/local-womens-jackets.json";
import bagCatalogue from "@/data/products/local-bags.json";
import type { Product } from "@/data/product-types";
import { previewProduct } from "@/lib/catalogue-preview-edits";
import { getProductAsset } from "@/assets";
import womensInventory from "@/data/womens-inventory.json";
import approvedWomensCatalogue from "@/data/products/approved-womens-catalogue.json";

const approvedWomenSlugs = new Set(approvedWomensCatalogue.products.map(product => product.slug));

export type LocalCatalogueProduct = Product & {
  itemGroupId: string;
  seoTitle: string;
  seoDescription: string;
  cataloguePreview: true;
  previewStockPerSize?: number;
};

// Never include unapproved local drafts in production builds or SSR seed tools.
export const LOCAL_JACKET_PRODUCTS: LocalCatalogueProduct[] =
  import.meta.env.DEV && !import.meta.env.SSR
    ? ([...catalogue.products, ...(bagCatalogue.pricesApproved ? [] : bagCatalogue.products).map(product => ({
        ...product,
        image: getProductAsset(product.image),
        gallery: product.gallery.map(getProductAsset),
      })), ...womensCatalogue.products.filter(product => !approvedWomenSlugs.has(product.slug)).map((product) => ({
        ...product,
        audience: "women" as const,
        sizes: womensInventory.sizes,
        previewStockPerSize: womensInventory.stockPerSizePerColour,
        specs: product.specs.map(spec => spec.label === "Sizing" ? { ...spec, value: "S–5XL. Refer to the supplied size chart." } : spec),
        image: getProductAsset(product.image),
        gallery: product.gallery.map(getProductAsset),
      }))] as LocalCatalogueProduct[]).map(previewProduct)
    : [];

const drafts = new Map(LOCAL_JACKET_PRODUCTS.map((product) => [product.slug, product]));

export function getLocalCatalogueProduct(slug: string) {
  return drafts.get(slug);
}
