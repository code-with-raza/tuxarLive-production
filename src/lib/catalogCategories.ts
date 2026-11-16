export const CATEGORY_CHILDREN: Record<string, string[]> = {
  "leather-jackets": ["leather-jackets", "classic", "bomber", "racing", "varsity", "flight_jacket"],
  "motorcycle-suits": ["motorcycle-suits"],
  "leather-bags": ["leather-bags"],
  accessories: ["accessories"],
};

export function categoryIncludes(categorySlug: string, productCategory: string, collections: { collection_slug: string }[] = []) {
  const id = categorySlug.replace(/^women-/, "");
  if ((CATEGORY_CHILDREN[id] ?? [id]).includes(productCategory)) return true;
  if (id === "bomber-jackets" && productCategory === "bomber") return true;
  // Styles are existing collection memberships, not duplicate category records.
  const style = (slug: string) => slug.replace(/^women-/, "").replace(/_/g, "-").replace(/-jackets$/, "");
  return categorySlug !== "leather-jackets" && collections.some(item => style(item.collection_slug) === style(categorySlug));
}

export function categoryLabel(slug: string) {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Legacy catalogue groups remain valid assignments, but are not extra public menu entries. */
export function storefrontManagedCategories<T extends { slug: string; audience: string }>(rows: T[], audience: string): T[] {
  return rows.filter(row => row.slug !== "bomber" && (row.audience === audience || row.audience === "both"));
}
