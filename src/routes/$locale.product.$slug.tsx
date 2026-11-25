import { useMarketCurrency, localeCurrency } from "@/lib/market";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Minus, Plus, ShieldCheck, Truck, Wrench, ChevronRight } from "lucide-react";

import { useShop } from "@/store/shop";
import { ProductCard } from "@/components/site/ProductCard";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { basketQuantity, initialInventorySelection, inventoryOffers, stockForSelection, validatedInventory, type ProductVariantStock } from "@/lib/product-inventory";
import { productDiscount, savingsLabel } from "@/lib/product-discount";
import { MensJacketSizeChart, usesMensJacketChart } from "@/components/site/MensJacketSizeChart";
import { Reveal } from "@/components/site/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import {
  t,
  Locale,
  getLocalizedProduct,
  resolveSlug,
  getLocalizedSlug,
  getLocalizedLink,
  getLocalizedColor,
  getLocalizedOption,
} from "@/i18n/i18n";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { PRODUCTS, getProductBySlug, type Product } from "@/data/products";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { useUIStore } from "@/store/ui";
import { publicSupabase as supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { getLocalCatalogueProduct } from "@/lib/local-catalogue";
import { carrierDeliveryEstimate } from "@/lib/delivery";
import { galleryWithSizeChart, productSizeChart } from "@/lib/product-size-chart";
import { relatedProducts } from "@/lib/related-products";

function colorImageIndex(gallery: string[], selectedColor: string) {
  const ignored = new Set(["black", "white", "red", "blue", "brown", "green"]);
  const tokens = selectedColor
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const orderedTokens = [...tokens.filter((token) => !ignored.has(token)), ...tokens];
  for (const token of orderedTokens) {
    const index = gallery.findIndex((image) =>
      decodeURIComponent(image).toLowerCase().includes(token),
    );
    if (index >= 0) return index;
  }
  return -1;
}

function productSeoTitle(product: Product, locale: Locale) {
  const localDraft = getLocalCatalogueProduct(product.slug);
  if (localDraft) return localDraft.seoTitle;
  if (locale === "en" && product.seoTitle?.trim()) return product.seoTitle;
  if (locale !== "en") return `${product.name} — Tuxar`;
  const suffix = " | Tuxar";
  const limit = 60 - suffix.length;
  const name =
    product.name.length > limit
      ? product.name.slice(0, limit).replace(/\s+\S*$/, "")
      : product.name;
  return `${name}${suffix}`;
}

function productSeoDescription(product: Product, locale: Locale) {
  const localDraft = getLocalCatalogueProduct(product.slug);
  if (localDraft) return localDraft.seoDescription;
  if (locale === "en" && product.seoDescription?.trim()) return product.seoDescription;
  if (locale !== "en") return product.description;
  const delivery = " Shop online with tracked UK delivery and clear return guidance.";
  const available = Math.max(70, 158 - delivery.length);
  const base =
    product.description.length > available
      ? `${product.description
          .slice(0, available)
          .replace(/\s+\S*$/, "")
          .replace(/[.,;:]$/, "")}.`
      : product.description;
  return `${base}${delivery}`;
}

export const Route = createFileRoute("/$locale/product/$slug")({
  staleTime: 0,
  beforeLoad: ({ params }) => {
    const locale = params.locale as Locale;
    const canonical = resolveSlug(params.slug, "product", locale);
    const slug = getLocalizedSlug(canonical, "product", locale);
    if (slug !== params.slug) throw redirect({ to: "/$locale/product/$slug", params: { locale, slug }, search: true, replace: true, statusCode: 301 });
  },
  loader: async ({ params }) => {
    const locale = params.locale as Locale;
    const canonicalSlug = resolveSlug(params.slug, "product", locale);

    const products = await getStorefrontProducts();
    const rawProduct = products.find(product => product.slug === canonicalSlug);
    if (!rawProduct) throw notFound();
    const product = getLocalizedProduct(rawProduct, locale);
    let inventoryError = false;
    // Stock is requested only for this product. Static HTML stays neutral until a fresh browser check.
    if (!import.meta.env.SSR && !getLocalCatalogueProduct(canonicalSlug)) {
      try {
        if (!isSupabaseConfigured()) throw new Error("Inventory is not configured");
        const { data, error } = await supabase.from("products")
          .select("product_variants(size,color,color_hex,stock,active,price_pence)")
          .eq("slug", canonicalSlug).eq("status", "active")
          .abortSignal(AbortSignal.timeout(15000)).maybeSingle();
        if (error || !data) throw new Error("Inventory lookup failed");
        product.inventory = validatedInventory(data.product_variants);
        product.inStock = product.inventory.some(variant => variant.stock > 0);
      } catch { inventoryError = true; }
    }

    const related = relatedProducts(rawProduct, products)
      .map((item) => getLocalizedProduct(item, locale));

    return { product, canonicalSlug, related, inventoryError };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.product;
    const locale = params.locale as Locale;
    if (!p) {
      return {
        meta: [
          { title: "Product not found — Tuxar" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }
    const localizedSlug = getLocalizedSlug(p.slug, "product", locale);
    const url = `/${locale}/product/${localizedSlug}`;
    const fullUrl = absoluteUrl(url);
    const socialImage = absoluteUrl(p.image);
    const title = productSeoTitle(p, locale);
    const description = productSeoDescription(p, locale);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(getLocalCatalogueProduct(p.slug) ? [{ name: "robots", content: "noindex, nofollow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: fullUrl },
        { property: "og:image", content: socialImage },
        { property: "og:image:alt", content: p.name },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: socialImage },
      ],
      links: [
        { rel: "canonical", href: fullUrl },
        ...localizedAlternates(
          (targetLocale) =>
            `/${targetLocale}/product/${getLocalizedSlug(p.slug, "product", targetLocale)}`,
        ),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            image: p.gallery.map(absoluteUrl),
            description: p.description,
            sku: p.slug,
            brand: { "@type": "Brand", name: "Tuxar" },
            category: p.category,
            color: p.colors.map((item) => item.name).join(", "),
            ...(!getLocalCatalogueProduct(p.slug) ? { offers: !import.meta.env.SSR && p.inventory ? inventoryOffers(p.inventory, p.priceGBP, localeCurrency(params.locale), fullUrl) : {
              "@type": "Offer",
              price: p.priceGBP,
              priceCurrency: localeCurrency(params.locale),
              itemCondition: "https://schema.org/NewCondition",
              url: fullUrl,
            } } : {}),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: t("common.home", locale),
                item: `https://tuxar.co.uk/${locale}/`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: t("nav.shop", locale),
                item: `https://tuxar.co.uk/${locale}/shop`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: p.name,
                item: fullUrl,
              },
            ],
          }),
        },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: ProductNotFound,
});

function ProductNotFound() {
  const { locale } = Route.useParams() as { locale: Locale };

  const shopLink = getLocalizedLink("/shop", locale);
  return (
    <div className="container-luxe py-32 text-center">
      <h1 className="font-display text-4xl">Piece not found</h1>
      <Link to={shopLink.to} params={shopLink.params} className="mt-6 inline-block underline">
        Back to shop
      </Link>
    </div>
  );
}

function ProductPage() {
  const { canonicalSlug } = Route.useLoaderData();
  return <ProductDetail key={canonicalSlug} />;
}

function ProductDetail() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { currency, formatMoney: formatGBP, formatSaving, formatLineMoney } = useMarketCurrency(locale);
  const {
    product: p,
    canonicalSlug,
    related,
    inventoryError: initialInventoryError = false,
  } = Route.useLoaderData() as {
    product: Product;
    canonicalSlug: string;
    related: Product[];
    inventoryError?: boolean;
  };
  const gallery = useMemo(() => galleryWithSizeChart(p), [p]);
  const sizeChart = productSizeChart(p);
  const requested = !import.meta.env.SSR ? new URLSearchParams(window.location.search) : undefined;
  const initialVariant = initialInventorySelection(p.inventory ?? [], requested?.get("size"), requested?.get("color"));
  const [size, setSize] = useState(initialVariant?.size ?? p.sizes[Math.floor(p.sizes.length / 2)]);
  const [color, setColor] = useState(initialVariant?.color ?? p.colors[0]?.name ?? "");
  const currentSelection = useRef({ size, color });
  currentSelection.current = { size, color };
  const [availableColors, setAvailableColors] = useState(p.colors);
  const [availableSizes, setAvailableSizes] = useState(p.sizes);
  const [variants, setVariants] = useState<ProductVariantStock[]>(p.inventory ?? []);
  const selectedPrice = variants.find(row => row.active && row.size === size && row.color === color)?.price_pence;
  const livePrice = selectedPrice != null ? selectedPrice / 100 : p.priceGBP;
  const comparePrice = p.comparePriceGBP ?? null;
  const discount = productDiscount(livePrice, comparePrice);
  const [inventoryLoading, setInventoryLoading] = useState(import.meta.env.SSR || (!p.inventory && !initialInventoryError));
  const [inventoryError, setInventoryError] = useState(initialInventoryError);
  const [addingToBag, setAddingToBag] = useState(false);
  const retryInventory = useRef<() => void>(() => undefined);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [loadedGalleryImage,setLoadedGalleryImage] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const suppressZoomClick = useRef(false);
  const { addToCart, toggleWish, wishlist } = useShop();
  const openCart = useUIStore((state) => state.openCart);
  const wished = wishlist.includes(canonicalSlug);

  useEffect(() => {
    if (getLocalCatalogueProduct(canonicalSlug)) return;
    trackEvent("view_item", {
      currency: currency === "USD" ? "GBP" : currency,
      value: p.priceGBP,
      items: [
        {
          item_id: canonicalSlug,
          item_name: p.name,
          item_category: p.category,
          price: p.priceGBP,
          quantity: 1,
        },
      ],
    });
  }, [canonicalSlug, p.category, p.name, p.priceGBP, currency]);

  useEffect(() => {
    const localDraft = getLocalCatalogueProduct(canonicalSlug);
    if (localDraft) {
      setAvailableColors(localDraft.colors);
      setAvailableSizes(localDraft.sizes);
      setColor(localDraft.colors[0].name);
      setSize(localDraft.sizes[0]);
      setVariants(localDraft.colors.flatMap((draftColor) => localDraft.sizes.map((draftSize) => ({ size: draftSize, color: draftColor.name, color_hex: draftColor.hex, stock: localDraft.previewStockPerSize ?? 10, active: true }))));
      setInventoryLoading(false);
      setInventoryError(false);
      return;
    }
    if (!isSupabaseConfigured()) { setInventoryLoading(false); setInventoryError(true); return; }
    let activeRequest = true;
    let requestVersion = 0;
    const apply = (active: ProductVariantStock[]) => {
        setVariants(active);
        const colors = Array.from(
          new Map(
            active.map((variant: any) => [
              variant.color,
              { name: variant.color, hex: variant.color_hex },
            ]),
          ).values(),
        ) as { name: string; hex: string }[];
        const sizes = [...new Set(active.map((variant: any) => variant.size))] as string[];
        setAvailableColors(colors);
        setAvailableSizes(sizes);
        const selected = initialInventorySelection(active, currentSelection.current.size, currentSelection.current.color);
        setColor(selected?.color ?? ""); setSize(selected?.size ?? "");
    };
    const refresh = async () => {
      const version = ++requestVersion;
      setInventoryLoading(true); setInventoryError(false);
      try {
        const { data, error } = await supabase.from("products")
          .select("product_variants(size,color,color_hex,stock,active,price_pence)")
          .eq("slug", canonicalSlug).eq("status", "active")
          .abortSignal(AbortSignal.timeout(15000)).maybeSingle();
        if (error || !data) throw new Error("Inventory lookup failed");
        const rows = validatedInventory(data.product_variants);
        if (activeRequest && version === requestVersion) apply(rows);
      } catch {
        if (activeRequest && version === requestVersion) setInventoryError(true);
      } finally {
        if (activeRequest && version === requestVersion) setInventoryLoading(false);
      }
    };
    retryInventory.current = () => { void refresh(); };
    if (p.inventory) { apply(p.inventory); setInventoryLoading(false); setInventoryError(false); }
    else if (initialInventoryError) { setInventoryLoading(false); setInventoryError(true); }
    else void refresh();
    window.addEventListener("focus", refresh);
    return () => { activeRequest = false; requestVersion++; window.removeEventListener("focus", refresh); };
  }, [canonicalSlug, p.inventory, initialInventoryError]);

  const selectedStock =
    stockForSelection(variants, size, color);

  useEffect(() => {
    if (getLocalCatalogueProduct(canonicalSlug)) return;
    const url = absoluteUrl(`/${locale}/product/${getLocalizedSlug(canonicalSlug, "product", locale)}`);
    const offers = inventoryLoading || inventoryError
      ? { "@type": "Offer", price: livePrice, priceCurrency: localeCurrency(locale), url }
      : inventoryOffers(variants, p.priceGBP, localeCurrency(locale), url);
    for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "null");
        if (data?.["@type"] === "Product" && data.sku === canonicalSlug) {
          data.offers = offers;
          script.textContent = JSON.stringify(data);
        }
      } catch { /* Other structured data is unrelated to this offer. */ }
    }
  }, [canonicalSlug, variants, inventoryLoading, inventoryError, livePrice, p.priceGBP, locale]);

  useEffect(() => {
    if (!variants.length) return;
    const colorSizes = variants
      .filter((variant) => variant.color === color)
      .map((variant) => variant.size);
    setAvailableSizes([...new Set(colorSizes)]);
    setSize((current) => colorSizes.includes(current) ? current : variants.find(variant => variant.color === color && variant.stock > 0)?.size ?? colorSizes[0] ?? "");
    setQty(1);
  }, [color, variants]);

  const showGalleryImage = useCallback((index: number) => {
    const total = gallery.length;
    if (!total) return;
    setActiveImg((index + total) % total);
    setZoomed(false);
  }, [gallery.length]);

  useEffect(() => {
    const index = colorImageIndex(p.gallery, color);
    if (index >= 0) showGalleryImage(index);
  }, [color, p.gallery, showGalleryImage]);

  useEffect(() => {
    const next = gallery[(activeImg + 1) % gallery.length];
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    if (!next || next === gallery[activeImg] || loadedGalleryImage !== gallery[activeImg] || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
    const image = new Image();
    image.fetchPriority = "low";
    image.src = cloudinaryUrl(next, {
      width: window.innerWidth < 768 ? 640 : 1200,
      height: window.innerWidth < 768 ? 800 : 1500,
      crop: "fit",
    });
  }, [activeImg, gallery, loadedGalleryImage]);

  async function handleAdd() {
    if (getLocalCatalogueProduct(canonicalSlug)) {
      toast.info("Local catalogue preview only. Ordering is disabled until this product is approved and published.");
      return;
    }
    if (addingToBag) return;
    if (inventoryLoading) { toast.info("Checking availability. Please wait."); return; }
    if (inventoryError) { toast.error("Availability could not be checked. Please try again."); return; }
    if (!selectedStock) {
      toast.error("This option is currently out of stock.");
      return;
    }
    let safeQty: number;
    setAddingToBag(true);
    try {
      const { data, error } = await supabase.from("products")
        .select("product_variants(size,color,color_hex,stock,active,price_pence)")
        .eq("slug", canonicalSlug).eq("status", "active")
        .eq("product_variants.size", size).eq("product_variants.color", color)
        .eq("product_variants.active", true)
        .abortSignal(AbortSignal.timeout(15000)).maybeSingle();
      if (error) throw error;
      const checked = validatedInventory(data?.product_variants ?? []);
      safeQty = basketQuantity(checked, size, color, qty);
      const stock = stockForSelection(checked, size, color);
      setVariants(current => data ? current.map(row => row.size === size && row.color === color ? { ...row, stock } : row) : []);
      if (!safeQty) { toast.error("This option is currently out of stock."); return; }
    } catch {
      setInventoryError(true);
      toast.error("Availability could not be checked. Please try again.");
      return;
    } finally { setAddingToBag(false); }
    addToCart({
      slug: canonicalSlug,
      name: p.name,
      image: gallery[activeImg] === sizeChart?.src ? p.image : (gallery[activeImg] ?? p.image),
      priceGBP: livePrice,
      comparePriceGBP: discount ? comparePrice! : undefined,
      size,
      color,
      qty: safeQty,
    });
    trackEvent("add_to_cart", {
      currency: currency === "USD" ? "GBP" : currency,
      value: livePrice * safeQty,
      items: [
        {
          item_id: canonicalSlug,
          item_name: p.name,
          item_category: p.category,
          item_variant: `${color} / ${size}`,
          price: livePrice,
          quantity: safeQty,
        },
      ],
    });
    const successMsg =
      locale === "it"
        ? `${p.name} aggiunto al carrello`
        : locale === "de"
          ? `${p.name} zum Warenkorb hinzugefügt`
          : locale === "fr"
            ? `${p.name} ajouté au panier`
            : locale === "es"
              ? `${p.name} añadido al carrito`
              : `${p.name} added to cart`;
    const successDesc =
      locale === "it"
        ? `Taglia ${size} · ${color}`
        : locale === "de"
          ? `Größe ${size} · ${color}`
          : locale === "fr"
            ? `Taille ${size} · ${color}`
            : locale === "es"
              ? `Talla ${size} · ${color}`
              : `Size ${size} · ${color}`;
    toast.success(successMsg, { description: successDesc });
    openCart();
  }

  function handleTouchEnd(clientX: number) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    suppressZoomClick.current = true;
    showGalleryImage(activeImg + (distance < 0 ? 1 : -1));
  }

  const homeLink = getLocalizedLink("/", locale);
  const shopLink = getLocalizedLink("/shop", locale);
  const sizeGuideLink = getLocalizedLink("/size-guide", locale);
  const shippingPolicyLink = getLocalizedLink("/shipping-policy", locale);

  return (
    <>
      {getLocalCatalogueProduct(canonicalSlug) && (
        <aside className="border-b bg-amber-50 px-6 py-3 text-center text-sm text-amber-950" role="status">
          Local catalogue preview · proposed price · {getLocalCatalogueProduct(canonicalSlug)?.previewStockPerSize ?? 10} {p.category === "leather-bags" ? "units" : "per size"} · ordering disabled · not published
        </aside>
      )}
      <div className="container-luxe py-6">
        <Breadcrumbs
          items={[
            { label: t("common.home", locale), to: homeLink.to, params: homeLink.params },
            { label: t("nav.shop", locale), to: shopLink.to, params: shopLink.params },
            { label: p.name },
          ]}
        />
      </div>
      <section className="container-luxe pb-16 grid lg:grid-cols-12 gap-8 lg:gap-14">
        {/* Gallery */}
        <Reveal repeat distance={18} amount={0.08} className="lg:col-span-7">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[80px_1fr]">
            <div className="hidden md:flex flex-col gap-2">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => showGalleryImage(i)}
                  className={`group/thumb aspect-[4/5] overflow-hidden bg-section border transition-all duration-300 ${activeImg === i ? "border-foreground" : "border-transparent hover:border-foreground/40"}`}
                  aria-label={g === sizeChart?.src ? "View size chart" : `View image ${i + 1}`}
                >
                  <img
                    src={cloudinaryUrl(g, { width: 160, height: 200, crop: (g === sizeChart?.src || p.category === "leather-bags") ? "fit" : "fill" })}
                    alt=""
                    className={`h-full w-full ${(g === sizeChart?.src || p.category === "leather-bags") ? "object-contain" : "object-cover"} transition-transform duration-700 ease-out group-hover/thumb:scale-105`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (suppressZoomClick.current) {
                  suppressZoomClick.current = false;
                  return;
                }
                setZoomed((value) => !value);
              }}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              aria-label={zoomed ? "Zoom out product image" : "Zoom in product image"}
              className={`relative block aspect-[4/5] w-full overflow-hidden bg-section ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            >
              <img
                src={cloudinaryUrl(gallery[activeImg], {
                  width: 960,
                  height: 1200,
                  crop: "fit",
                })}
                srcSet={gallery[activeImg] === sizeChart?.src ? undefined : `${cloudinaryUrl(gallery[activeImg], { width: 480, height: 600, crop: "fit" })} 480w, ${cloudinaryUrl(gallery[activeImg], { width: 640, height: 800, crop: "fit" })} 640w, ${cloudinaryUrl(gallery[activeImg], { width: 960, height: 1200, crop: "fit" })} 960w, ${cloudinaryUrl(gallery[activeImg], { width: 1200, height: 1500, crop: "fit" })} 1200w`}
                sizes="(min-width: 1024px) 55vw, (min-width: 768px) 85vw, 100vw"
                alt={gallery[activeImg] === sizeChart?.src ? sizeChart.alt : p.name}
                loading="eager"
                fetchPriority="high"
                onLoad={() => setLoadedGalleryImage(gallery[activeImg])}
                decoding="async"
                className={`animate-luxe-product-image h-full w-full ${(gallery[activeImg] === sizeChart?.src || p.category === "leather-bags") ? "object-contain" : "object-cover"} transition-transform duration-700 ease-out ${zoomed ? "scale-[1.55]" : "scale-100"}`}
                width={gallery[activeImg] === sizeChart?.src ? 1600 : 1000}
                height={gallery[activeImg] === sizeChart?.src ? 640 : 1250}
              />
              <span className="pointer-events-none absolute bottom-4 right-4 bg-background/85 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground opacity-0 backdrop-blur-sm transition-opacity duration-300 md:opacity-100">
                {zoomed ? "Zoom out" : "Click to zoom"}
              </span>
            </button>
            <div
              className="mt-4 flex items-center justify-center gap-2 md:hidden"
              aria-label="Product images"
            >
              {gallery.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => showGalleryImage(index)}
                  aria-label={image === sizeChart?.src ? "View size chart" : `View image ${index + 1}`}
                  aria-current={activeImg === index ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all duration-300 ${activeImg === index ? "w-7 bg-foreground" : "w-1.5 bg-foreground/25"}`}
                />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Info */}
        <Reveal
          repeat
          delay={0.08}
          distance={18}
          amount={0.08}
          className="lg:col-span-5 lg:sticky lg:top-28 self-start"
        >
          <h1 className="font-display text-3xl md:text-4xl leading-tight">{p.name}</h1>
          <p className="mt-2 text-muted-foreground">{p.tagline}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <div className="flex items-center gap-3 text-2xl font-display">
              <span>{formatGBP(livePrice)}</span>
              {comparePrice && comparePrice > livePrice && (
                <span className="text-base text-muted-foreground line-through">
                  {formatGBP(comparePrice)}
                </span>
              )}
            </div>
          </div>
          {discount && (
            <p className="mt-2 text-sm text-emerald-800">
              {savingsLabel(locale, formatSaving(comparePrice!, livePrice), discount.percent)}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 text-sm text-foreground/75">
            <span className={`h-2 w-2 rounded-full ${inventoryLoading ? "bg-amber-500" : !inventoryError && selectedStock > 0 ? "bg-emerald-600" : "bg-zinc-400"}`} aria-hidden="true" />
            <span>
              {getLocalCatalogueProduct(canonicalSlug) ? "Local draft — not available to order" : inventoryLoading ? "Checking availability…" : inventoryError ? "Availability could not be checked. Please try again." : !selectedStock ? "Currently out of stock" : locale === "it"
                ? "Disponibile su ordinazione"
                : locale === "de"
                  ? "Bestellbar"
                  : locale === "fr"
                    ? "Disponible à la commande"
                    : locale === "es"
                      ? "Disponible para pedir"
                      : "Available to order"}
            </span>
          </div>

          {inventoryError && <button type="button" onClick={() => retryInventory.current()} className="mt-2 text-sm underline">Retry availability check</button>}

          {availableColors.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <span className="eyebrow">
                  {locale === "it"
                    ? "Colore"
                    : locale === "de"
                      ? "Farbe"
                      : locale === "fr"
                        ? "Couleur"
                        : locale === "es"
                          ? "Color"
                          : "Colour"}
                </span>
                <span className="text-sm text-muted-foreground">{getLocalizedColor(color, locale)}</span>
              </div>
              <div className="flex gap-2">
                {availableColors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.name)}
                    aria-label={getLocalizedColor(c.name, locale)}
                    style={{ background: c.hex }}
                    className={`h-9 w-9 rounded-full border-2 transition-all duration-300 hover:scale-110 ${color === c.name ? "border-foreground ring-2 ring-foreground/15 ring-offset-2" : "border-border"}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">
                {locale === "it"
                  ? "Taglia"
                  : locale === "de"
                    ? "Größe"
                    : locale === "fr"
                      ? "Taille"
                      : locale === "es"
                        ? "Talla"
                        : "Size"}
              </span>
              <Link
                to={sizeGuideLink.to}
                params={sizeGuideLink.params}
                className="text-xs underline text-muted-foreground"
              >
                {locale === "it"
                  ? "Guida alle taglie"
                  : locale === "de"
                    ? "Größenberater"
                    : locale === "fr"
                      ? "Guide des tailles"
                      : locale === "es"
                        ? "Guía de tallas"
                        : "Size guide"}
              </Link>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {availableSizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  disabled={!inventoryLoading && !inventoryError && stockForSelection(variants, s, color) === 0}
                  aria-label={`${getLocalizedOption(s, locale)}${!inventoryLoading && !inventoryError && stockForSelection(variants, s, color) === 0 ? " — out of stock" : ""}`}
                  className={`h-11 text-sm border transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${size === s ? "border-foreground bg-foreground text-background shadow-soft" : "border-border hover:border-foreground"}`}
                >
                  {getLocalizedOption(s, locale)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {locale === "en" ? (
                <>
                  Unsure about fit?{" "}
                  <Link
                    to="/$locale/contact"
                    params={{ locale }}
                    className="underline underline-offset-2"
                  >
                    Ask our team before ordering.
                  </Link>
                </>
              ) : (
                ({ it:"Contatta il nostro team per un consiglio sulla taglia.", de:"Kontaktieren Sie unser Team für eine persönliche Größenberatung.", fr:"Contactez notre équipe pour un conseil personnalisé sur les tailles.", es:"Contacta con nuestro equipo para recibir ayuda con la talla." }[locale])
              )}
            </p>
          </div>

          {usesMensJacketChart(p) && <MensJacketSizeChart locale={locale} />}

          <div className="mt-8 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:flex sm:items-stretch">
            <div className="flex items-center border border-border">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="grid h-12 w-10 place-items-center sm:w-12"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" strokeWidth={1.4} />
              </button>
              <span className="w-8 text-center text-sm sm:w-10">{qty}</span>
              <button
                onClick={() => setQty(Math.min(selectedStock, qty + 1))}
                disabled={selectedStock === 0 || qty >= selectedStock}
                className="grid h-12 w-10 place-items-center disabled:cursor-not-allowed disabled:opacity-30 sm:w-12"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" strokeWidth={1.4} />
              </button>
            </div>
            <span className="col-span-2 row-start-1 self-center text-right text-[11px] text-muted-foreground sm:col-auto sm:text-left">
              {getLocalCatalogueProduct(canonicalSlug) ? `${selectedStock} ${p.category === "leather-bags" ? "units" : "per size"} (draft)` : inventoryLoading || addingToBag ? "Checking availability…" : inventoryError ? "Availability check failed" : selectedStock > 0 ? `${selectedStock} available` : "Out of stock"}
            </span>
            <button
              onClick={handleAdd}
              disabled={Boolean(getLocalCatalogueProduct(canonicalSlug)) || inventoryLoading || inventoryError || addingToBag || selectedStock === 0}
              className="luxe-button col-span-2 row-start-2 h-12 w-full min-w-0 bg-foreground px-3 text-center text-xs uppercase tracking-[0.12em] text-background disabled:cursor-not-allowed disabled:opacity-40 sm:col-auto sm:row-auto sm:flex-1 sm:text-sm sm:tracking-widest"
            >
              {getLocalCatalogueProduct(canonicalSlug) ? "Preview only" : locale === "it"
                ? "Aggiungi al carrello"
                : locale === "de"
                  ? "In den Warenkorb"
                  : locale === "fr"
                    ? "Ajouter au panier"
                    : locale === "es"
                      ? "Añadir al carrito"
                      : "Add to bag"}{" "}
              · {formatLineMoney(livePrice, qty)}
            </button>
            <button
              onClick={() => toggleWish(canonicalSlug)}
              aria-label="Wishlist"
              className="col-start-3 row-start-2 grid h-12 w-full place-items-center border border-border hover:bg-section sm:col-auto sm:row-auto sm:w-12"
            >
              <Heart
                className="h-4 w-4"
                fill={wished ? "currentColor" : "none"}
                strokeWidth={1.4}
              />
            </button>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 text-[11px] uppercase tracking-widest text-muted-foreground font-sans sm:grid-cols-3 sm:gap-2">
            <li className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" strokeWidth={1.4} />{" "}
              {locale === "it"
                ? "Consegna tracciata"
                : locale === "de"
                  ? "Sendungsverfolgung"
                  : locale === "fr"
                    ? "Livraison suivie"
                    : locale === "es"
                      ? "Envío con seguimiento"
                      : "Tracked delivery"}
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.4} />{" "}
              {locale === "it"
                ? "Politica resi"
                : locale === "de"
                  ? "Rückgaberichtlinie"
                  : locale === "fr"
                    ? "Politique de retour"
                    : locale === "es"
                      ? "Política de devoluciones"
                      : "Returns policy"}
            </li>
            <li className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" strokeWidth={1.4} />{" "}
              {locale === "it"
                ? "Supporto cura e riparazione"
                : locale === "de"
                  ? "Pflege- & Reparaturhilfe"
                  : locale === "fr"
                    ? "Aide entretien & réparation"
                    : locale === "es"
                      ? "Ayuda de cuidado y reparación"
                      : "Care & repair support"}
            </li>
          </ul>

          <Accordion type="multiple" defaultValue={["desc"]} className="mt-10">
            <AccordionItem value="desc">
              <AccordionTrigger>
                {locale === "it"
                  ? "Descrizione"
                  : locale === "de"
                    ? "Beschreibung"
                    : locale === "fr"
                      ? "Description"
                      : locale === "es"
                        ? "Descripción"
                        : "Description"}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {p.description}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="specs">
              <AccordionTrigger>
                {locale === "it"
                  ? "Specifiche"
                  : locale === "de"
                    ? "Spezifikationen"
                    : locale === "fr"
                      ? "Caractéristiques"
                      : locale === "es"
                        ? "Especificaciones"
                        : "Specifications"}
              </AccordionTrigger>
              <AccordionContent>
                <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
                  {p.specs.map((s) => (
                    <div key={s.label} className="contents">
                      <dt className="text-muted-foreground">{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger>
                {locale === "it"
                  ? "Spedizioni e Resi"
                  : locale === "de"
                    ? "Versand & Rückgabe"
                    : locale === "fr"
                      ? "Livraison & Retours"
                      : locale === "es"
                        ? "Envíos y Devoluciones"
                        : "Shipping & Returns"}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {carrierDeliveryEstimate(locale)}{" "}{locale === "it"
                  ? "Consulta la politica di reso prima di ordinare."
                  : locale === "de"
                    ? "Bitte lesen Sie vor der Bestellung die Rückgaberichtlinie."
                    : locale === "fr"
                      ? "Consultez la politique de retour avant de commander."
                      : locale === "es"
                        ? "Consulta la política de devoluciones antes de pedir."
                        : "Please review the returns policy before ordering."}{" "}
                <Link
                  to={shippingPolicyLink.to}
                  params={shippingPolicyLink.params}
                  className="underline"
                >
                  {locale === "it"
                    ? "Leggi di più"
                    : locale === "de"
                      ? "Mehr erfahren"
                      : locale === "fr"
                        ? "En savoir plus"
                        : locale === "es"
                          ? "Saber más"
                          : "Read more"}
                </Link>
                .
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Reveal>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-12px_40px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-4 pb-[env(safe-area-inset-bottom)]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm">{p.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {getLocalizedOption(size,locale)} · {getLocalizedColor(color,locale)} · {formatLineMoney(livePrice, qty)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={Boolean(getLocalCatalogueProduct(canonicalSlug)) || inventoryLoading || inventoryError || addingToBag || selectedStock === 0}
            className="luxe-button h-11 shrink-0 bg-foreground px-5 text-[11px] uppercase tracking-widest text-background disabled:opacity-40"
          >
            {getLocalCatalogueProduct(canonicalSlug) ? "Preview only" : locale === "it"
              ? "Aggiungi"
              : locale === "de"
                ? "Hinzufügen"
                : locale === "fr"
                  ? "Ajouter"
                  : locale === "es"
                    ? "Añadir"
                    : "Add to bag"}
          </button>
        </div>
      </div>

      {/* Related */}
      <section className="bg-surface py-20">
        <div className="container-luxe">
          <Reveal repeat distance={16}>
            <h2 className="font-display text-3xl md:text-4xl mb-10">
              {locale === "it"
                ? "Potrebbe piacerti anche"
                : locale === "de"
                  ? "Das könnte Ihnen auch gefallen"
                  : locale === "fr"
                    ? "Vous aimerez aussi"
                    : locale === "es"
                      ? "También podría gustarle"
                      : "You may also like"}
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 md:gap-x-6">
            {related.map((r) => (
              <ProductCard key={r.slug} p={r} repeat />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
