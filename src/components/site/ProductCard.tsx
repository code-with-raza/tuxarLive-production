import { useMarketCurrency, localeCurrency } from "@/lib/market";
import { useState } from "react";
import { productDiscount, savingsLabel } from "@/lib/product-discount";
import { Link, useParams } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { type Product } from "@/data/products";
import { useShop } from "@/store/shop";
import { getLocalizedLink, getLocalizedProduct, type Locale } from "@/i18n/i18n";
import { cloudinaryUrl, bagImageUrl } from "@/lib/cloudinary";

export function ProductCard({
  p: rawProduct,
  priority = false,
}: {
  p: Product;
  priority?: boolean;
  repeat?: boolean;
  delay?: number;
}) {
  const { locale = "en" } = useParams({ strict: false }) as { locale?: Locale };
  const { currency, formatMoney: formatGBP, formatSaving } = useMarketCurrency(locale);
  const p = getLocalizedProduct(rawProduct,locale);
  const discount = productDiscount(p.priceGBP, p.comparePriceGBP);
  const toggleWish = useShop((s) => s.toggleWish);
  const isWished = useShop((s) => s.wishlist.includes(p.slug));

  const cardImage = (url: string, width: number, height: number) => p.category === "leather-bags"
    ? bagImageUrl(url, width, height)
    : cloudinaryUrl(url, { width, height, crop: "fill" });

  const alternateImage = p.gallery.find((image) => image !== p.image);
  const [hoverRequested,setHoverRequested] = useState(false);
  const [loadedAlternate,setLoadedAlternate] = useState<string | null>(null);
  const alternateReady = Boolean(alternateImage && loadedAlternate === alternateImage);

  return (
      <article data-publication-product={p.slug} className="luxe-product-card group relative"
        onPointerEnter={event => { if (event.pointerType === "mouse") setHoverRequested(true); }}
        onFocusCapture={event => { if (event.target.matches(":focus-visible")) setHoverRequested(true); }}>
        <Link
          {...getLocalizedLink("/product/$slug", locale, { slug: p.slug })}
          className="block"
          aria-label={p.name}
        >
          <div className={`luxe-product-media relative overflow-hidden ${p.category === "leather-bags" ? "bg-white" : "bg-section"} aspect-[4/5]`}>
            <img
              src={cardImage(p.image, 700, 875)}
              srcSet={`${cardImage(p.image, 360, 450)} 360w, ${cardImage(p.image, 520, 650)} 520w, ${cardImage(p.image, 700, 875)} 700w`}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              alt={p.name}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : undefined}
              width={1000}
              height={1250}
              className={`h-full w-full ${p.category === "leather-bags" ? "object-contain" : "object-cover"} transition-all duration-300 ease-out group-hover:scale-[1.025] ${alternateReady ? "group-hover:opacity-0 group-focus-within:opacity-0" : ""}`}
            />
            {alternateImage && hoverRequested && (
              <img
                src={cardImage(alternateImage, 700, 875)}
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="low"
                onLoad={() => setLoadedAlternate(alternateImage)}
                onError={() => setLoadedAlternate(null)}
                srcSet={`${cardImage(alternateImage, 360, 450)} 360w, ${cardImage(alternateImage, 520, 650)} 520w, ${cardImage(alternateImage, 700, 875)} 700w`}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                width={1000}
                height={1250}
                className={`absolute inset-0 h-full w-full scale-[1.025] ${p.category === "leather-bags" ? "object-contain" : "object-cover"} opacity-0 transition-all duration-300 ease-out ${alternateReady ? "group-hover:scale-100 group-hover:opacity-100 group-focus-within:opacity-100" : ""}`}
              />
            )}
            <span className="luxe-product-hover-label pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 bg-background/90 px-4 py-2 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm md:block">
              View piece
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                toggleWish(p.slug);
              }}
              aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
              className="absolute right-3 top-3 p-2 bg-background/90 backdrop-blur-sm rounded-full opacity-100 transition-all duration-300 hover:scale-105 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <Heart
                className="h-4 w-4"
                fill={isWished ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            </button>
          </div>
          <div className="luxe-product-meta pt-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-base md:text-[17px] leading-snug truncate">
                {p.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.tagline}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm">{formatGBP(p.priceGBP)}</div>
              {discount && (
                <div className="text-xs text-muted-foreground line-through">
                  {formatGBP(p.comparePriceGBP!)}
                </div>
              )}
            </div>
          </div>
          {discount && <p className="mt-1 text-xs text-emerald-800">{savingsLabel(locale, formatSaving(p.comparePriceGBP!, p.priceGBP), discount.percent)}</p>}
        </Link>
      </article>
  );
}
