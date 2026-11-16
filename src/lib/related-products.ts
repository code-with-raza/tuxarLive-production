import type { Product } from "@/data/product-types";
import { isProductForAudience } from "./product-audience.ts";
import { categoryIncludes } from "./catalogCategories.ts";

type Item = Product & {itemGroupId?: string};
export function recommendationFamily(product: Item): string {
  if (product.itemGroupId) return product.itemGroupId;
  const colours = new Set(product.colors.flatMap(colour => colour.name.toLowerCase().split(/[^a-z]+/)).filter(Boolean));
  return product.slug.split('-').filter(word => !colours.has(word)).join('-');
}
export function recommendationStyle(product: Product): string {
  return (product.collections?.find(slug => !/^(?:women-)?(?:best-sellers|featured-pieces|new-in|all|leather-jackets)$/.test(slug)) ?? product.category).replace(/^women-/, '');
}
function rank(key: string) {
  let value = 2166136261;
  for (let i=0;i<key.length;i++) value = Math.imul(value ^ key.charCodeAt(i),16777619);
  return value >>> 0;
}
/** Stable per product and locale; distinct styles first, never other colourways of this design. */
export function relatedProducts(current: Item, catalogue: readonly Item[], limit = 4): Product[] {
  const audience = current.audience === 'both' ? undefined : isProductForAudience(current,'women') ? 'women' : 'men';
  const jackets = categoryIncludes('leather-jackets',current.category);
  const family = recommendationFamily(current), currentStyle = recommendationStyle(current);
  const pool = catalogue.filter(item => item.slug !== current.slug && recommendationFamily(item) !== family && item.inStock !== false &&
    (!audience || isProductForAudience(item,audience)) &&
    (jackets ? categoryIncludes('leather-jackets',item.category) : item.category === current.category))
    .slice().sort((a,b) => Number(recommendationStyle(a)===currentStyle)-Number(recommendationStyle(b)===currentStyle) ||
      rank(`${current.slug}:${a.slug}`)-rank(`${current.slug}:${b.slug}`) || a.slug.localeCompare(b.slug));
  const selected: Product[] = [], families = new Set<string>(), styles = new Set<string>();
  for (const diverse of [true,false]) for (const item of pool) {
    if (selected.length >= limit) return selected;
    const group = recommendationFamily(item), style = recommendationStyle(item);
    if (families.has(group) || (diverse && styles.has(style))) continue;
    selected.push(item);families.add(group);styles.add(style);
  }
  return selected;
}
