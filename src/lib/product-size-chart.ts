import type { Product } from "@/data/product-types";
import { CATEGORY_CHILDREN } from "./catalogCategories";
import { isProductForAudience } from "./product-audience";
import { MENS_JACKET_SIZE_CHART, WOMENS_JACKET_SIZE_CHART } from "./size-chart-assets";

export function productSizeChart(product: Product) {
  if (!CATEGORY_CHILDREN["leather-jackets"].includes(product.category)) return undefined;
  const women = isProductForAudience(product, "women");
  return {
    src: women ? WOMENS_JACKET_SIZE_CHART : MENS_JACKET_SIZE_CHART,
    alt: women ? "Women's supplied size chart, labelled Women Vest Size Chart" : "Men's jacket size chart, XS to 6XL",
    width: 1600,
    height: 640,
  };
}

export function galleryWithSizeChart(product: Product) {
  const chart = productSizeChart(product);
  const photos = product.gallery.length ? product.gallery : [product.image];
  if (!chart) return photos;
  // Keep one chart at the end, even when it was already assigned to a product.
  return [...photos.filter(image => !isJacketSizeChart(image)), chart.src];
}

function isJacketSizeChart(image: string) {
  const pathname = new URL(image, "https://tuxar.co.uk").pathname;
  return ["/size-charts/womens-jackets.webp", "/size-charts/mens-jackets.webp"].includes(pathname)
    || /\/(?:women-vest-size-chart|mens-jackets-size-chart)\.webp$/.test(pathname);
}
