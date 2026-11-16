import type { Collection, Product } from "@/data/product-types";

const key = "tuxar-catalogue-preview-edits-v1";
type Edits = {
  products: Record<string, Partial<Product>>;
  categories: Record<string, Partial<Collection>>;
};
export function readPreviewEdits(): Edits {
  if (!import.meta.env.DEV || typeof window === "undefined")
    return { products: {}, categories: {} };
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "{}");
    return { products: value.products || {}, categories: value.categories || {} };
  } catch {
    return { products: {}, categories: {} };
  }
}
export function previewProduct<T extends Product>(product: T): T {
  const edit = readPreviewEdits().products[product.slug];
  if (!edit) return product;
  return {
    ...product,
    ...Object.fromEntries(
      ["name", "tagline", "description", "priceGBP", "seoTitle", "seoDescription"]
        .filter((field) => field in edit)
        .map((field) => [field, (edit as Record<string, unknown>)[field]]),
    ),
  };
}
export function previewCollection<T extends Collection>(collection: T): T {
  const edit = readPreviewEdits().categories[collection.slug];
  if (!edit) return collection;
  return {
    ...collection,
    ...Object.fromEntries(
      ["title", "description", "metaIntro", "seoContent", "seoTitle"]
        .filter((field) => field in edit)
        .map((field) => [field, (edit as Record<string, unknown>)[field]]),
    ),
  };
}
export function savePreviewEdit(
  kind: "products" | "categories",
  slug: string,
  edit: Partial<Product> | Partial<Collection>,
) {
  if (!import.meta.env.DEV || typeof window === "undefined")
    throw new Error("Local preview editing is only available in development.");
  const edits = readPreviewEdits();
  edits[kind][slug] = edit;
  window.localStorage.setItem(key, JSON.stringify(edits));
}
