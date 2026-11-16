import { COLLECTIONS, type Product } from "@/data/products";
import { getLocalizedSlug, getLocalizedCollection, getLocalizedProduct, type Locale } from "@/i18n/i18n";
export type BannerDestination = { href: string; label: string; group: "Pages" | "Collections" | "Products" };
export function bannerDestinations(locale: Locale, products: Product[]): BannerDestination[] {
  const pages = [
    ["", "Homepage"], ["/shop", "Shop all"], ["/sales", "Sale"],
    ["/leather-jackets", "Men’s leather jackets"], ["/women-leather-jackets", "Women’s leather jackets"],
    ["/motorcycle-suits", "Motorcycle suits"], ["/leather-bags", "Leather bags"], ["/accessories", "Accessories"],
    ["/about", "Atelier / About"], ["/contact", "Contact"], ["/blog", "Journal"], ["/size-guide", "Size guide"],
  ].map(([path, label]) => ({ href: "/" + locale + path, label, group: "Pages" as const }));
  const collections = COLLECTIONS.map(collection => ({
    href: "/" + locale + "/collections/" + getLocalizedSlug(collection.slug, "collection", locale),
    label: getLocalizedCollection(collection, locale).title, group: "Collections" as const,
  }));
  const items = products.map(product => ({
    href: "/" + locale + "/product/" + getLocalizedSlug(product.slug, "product", locale),
    label: getLocalizedProduct(product, locale).name, group: "Products" as const,
  }));
  return [...new Map([...pages, ...collections, ...items].map(item => [item.href, item])).values()];
}
