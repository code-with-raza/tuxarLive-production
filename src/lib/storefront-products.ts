import { PRODUCTS, type Product } from "@/data/products";
import { publicSupabase as supabase, isSupabaseConfigured } from "@/lib/supabase";

export type StorefrontPrice = { slug: string; status: string; price_pence: number; compare_price_pence: number | null; product_images?: { url: string; position: number }[] };

/** The database owns publication, prices and uploaded galleries; retain source fallbacks. */
export function applyStorefrontPrices(products: Product[], rows: StorefrontPrice[]): Product[] {
  const active = new Map(rows.filter(row => row.status === "active").map(row => [row.slug, row]));
  return products.flatMap(product => {
    const row = active.get(product.slug);
    if (!row || !Number.isInteger(row.price_pence) || row.price_pence < 0) return [];
    const gallery = [...(row.product_images ?? [])]
      .filter(image => /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(image.url))
      .sort((a,b) => a.position-b.position).map(image => image.url);
    return [{ ...product, priceGBP: row.price_pence / 100,
      ...(gallery.length ? { image: gallery[0], gallery: [...new Set(gallery)] } : {}),
      comparePriceGBP: row.compare_price_pence !== null && row.compare_price_pence > row.price_pence
        ? row.compare_price_pence / 100 : undefined }];
  });
}

let pending: Promise<Product[]> | undefined;
let buildSnapshot: Product[] | undefined;

/** No persistent browser cache: each navigation checks current publication and prices. */
export function getStorefrontProducts(): Promise<Product[]> {
  if (import.meta.env.SSR && buildSnapshot) return Promise.resolve(buildSnapshot);
  if (!isSupabaseConfigured()) {
    // Local design previews can run without a backend. Production must never fall back to old prices.
    return import.meta.env.DEV ? Promise.resolve(PRODUCTS) : Promise.reject(new Error("The catalogue is unavailable. Please try again."));
  }
  if (pending) return pending;
  pending = (async () => {
    const rows: StorefrontPrice[] = [];
    // Page explicitly so PostgREST's row limit cannot silently hide the end of the catalogue.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("products")
        .select("slug,status,price_pence,compare_price_pence,product_images(url,position)").eq("status", "active")
        .order("slug").range(offset, offset + 499).abortSignal(AbortSignal.timeout(15000));
      if (error) throw new Error("The catalogue could not be loaded. Please try again.");
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    const products = applyStorefrontPrices(PRODUCTS, rows);
    // Unpublished local fixtures remain development-only and cannot override database products.
    const previews = import.meta.env.DEV ? PRODUCTS.filter(p => "cataloguePreview" in p && p.cataloguePreview === true) : [];
    const result = [...products, ...previews.filter(p => !rows.some(row => row.slug === p.slug))];
    if (import.meta.env.SSR) buildSnapshot = result;
    return result;
  })().finally(() => { pending = undefined; });
  return pending;
}
