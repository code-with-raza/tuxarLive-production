import type { Collection, Product } from "@/data/product-types";

export type ProductAudience = "men" | "women";

export function collectionAudience(slug: string): ProductAudience | undefined {
  if (slug.startsWith("women-") || ["cropped-jackets", "leather-fur-jackets"].includes(slug)) return "women";
  return "men";
}

export function getAudienceCollection(
  slug: string,
  name: string,
  audience: ProductAudience,
  collections: readonly Collection[],
) {
  if (audience === "women" && slug === "puffer") {
    return collections.find((collection) => collection.slug === "women-puffer-jackets");
  }
  // Managed categories can retain their old display name and an unrelated slug.
  if (audience === "women" && /^(women(?:'s)?\s+)?aviator jackets$/i.test(name.trim())) {
    return collections.find((collection) => collection.slug === "women-aviator-jackets");
  }
  if (audience === "women" && /^(women(?:'s)?\s+)?varsity(?: jackets)?$/i.test(name.trim())) {
    return collections.find((collection) => collection.slug === "women-varsity-jackets");
  }
  if (audience === "women" && /^(women(?:'s)?\s+)?racing(?: jackets)?$/i.test(name.trim())) {
    return collections.find((collection) => collection.slug === "women-racing-jackets");
  }
  if (audience === "women" && /^(women(?:'s)?\s+)?shearling jackets$/i.test(name.trim())) {
    return collections.find((collection) => collection.slug === "women-shearling-jackets");
  }
  if (audience === "women" && /^(women(?:'s)?\s+)?puffer jackets$/i.test(name.trim())) {
    return collections.find((collection) => collection.slug === "women-puffer-jackets");
  }
  const audienceSlug = audience === "women" && !slug.startsWith("women-") && !["cropped-jackets", "leather-fur-jackets"].includes(slug)
    ? `women-${slug}` : slug;
  return collections.find((collection) => collection.slug === audienceSlug && collectionAudience(collection.slug) === audience)
    ?? collections.find((collection) => collectionAudience(collection.slug) === audience && collection.title.trim().toLowerCase() === name.trim().toLowerCase());
}

export function isProductForAudience(
  product: Pick<Product, "slug" | "name" | "audience">,
  audience: ProductAudience,
) {
  // Existing published menswear predates explicit audience metadata.
  const assigned = product.audience ??
    (/^womens-/.test(product.slug) || /^women(?:['’]s|\s)/i.test(product.name) ? "women" : "men");
  return assigned === "both" || assigned === audience;
}
