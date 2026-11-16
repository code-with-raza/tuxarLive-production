import type { Product } from "@/data/product-types";

export function previewAdminRows(existing: { slug: string }[], drafts: Product[], status: string) {
  if (!["all", "draft"].includes(status)) return [];
  const slugs = new Set(existing.map((product) => product.slug));
  return drafts
    .filter((product) => !slugs.has(product.slug))
    .map((product) => ({
      id: `preview--${product.slug}`,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price_pence: Math.round(product.priceGBP * 100),
      status: "draft",
      product_variants: [],
    }));
}
export const normaliseCatalogueSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
