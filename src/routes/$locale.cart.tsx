import { useMarketCurrency, localeCurrency } from "@/lib/market";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { useShop, cartTotalGBP } from "@/store/shop";

import { PageHero } from "@/components/site/PageHero";
import { t, Locale, getLocalizedLink } from "@/i18n/i18n";
import { trackEvent } from "@/lib/analytics";
import { useCartInventory } from "@/hooks/useCartInventory";
import { variantKey } from "@/lib/cart-inventory";
import { useUser } from "@/hooks/useUser";

export const Route = createFileRoute("/$locale/cart")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    return {
      meta: [
        { title: `${t("nav.cart", locale)} — Tuxar` },
        { name: "description", content: t("footer.description", locale) },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: `/${locale}/cart` }],
    };
  },
  component: Cart,
});

function Cart() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { currency, formatMoney: formatGBP, formatLineMoney, formatCartTotal } = useMarketCurrency(locale);
  const { cart, setQty, removeFromCart } = useShop();
  const { user } = useUser();
  const stockByVariant = useCartInventory(cart);
  const subtotal = cartTotalGBP(cart);
  const shipping = 0;
  const total = subtotal + shipping;

  useEffect(() => {
    if (!cart.length) return;
    trackEvent("view_cart", {
      currency: currency === "USD" ? "GBP" : currency,
      value: total,
      items: cart.map((item) => ({
        item_id: item.slug,
        item_name: item.name,
        item_variant: `${item.color} / ${item.size}`,
        price: item.priceGBP,
        quantity: item.qty,
      })),
    });
  }, [cart, total, currency]);


  return (
    <>
      <PageHero
        eyebrow={t("nav.cart", locale)}
        title={
          cart.length
            ? `${cart.length} ${cart.length === 1 ? t("common.piece", locale) : t("common.pieces", locale)} ${locale === "it" ? "nel tuo carrello." : locale === "de" ? "in Ihrem Warenkorb." : locale === "fr" ? "dans votre sac." : locale === "es" ? "en tu bolsa." : "in your bag."}`
            : t("common.emptyCart", locale) + "."
        }
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.cart", locale) },
        ]}
      />
      <section className="container-luxe py-12 grid lg:grid-cols-[1fr_400px] gap-12">
        <div>
          {cart.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground mb-6">
                {locale === "it"
                  ? "Nessun articolo ancora. Scopri i nuovi arrivi."
                  : locale === "de"
                    ? "Noch keine Artikel. Entdecken Sie die Neuheiten."
                    : locale === "fr"
                      ? "Pas encore de pièces. Découvrez les nouveautés."
                      : locale === "es"
                        ? "Aún no hay artículos. Descubre las novedades."
                        : "No pieces yet. Discover the new arrivals."}
              </p>
              <Link
                {...getLocalizedLink("/shop", locale)}
                className="inline-flex h-12 items-center gap-2 bg-foreground text-background px-7 text-sm tracking-widest uppercase"
              >
                {locale === "it"
                  ? "Acquista la collezione"
                  : locale === "de"
                    ? "Kollektion shoppen"
                    : locale === "fr"
                      ? "Acheter la collection"
                      : locale === "es"
                        ? "Comprar la colección"
                        : "Shop the collection"}{" "}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {cart.map((item) => (
                <li key={`${item.slug}-${item.size}-${item.color}`} className="py-6 flex gap-5">
                  <Link
                    {...getLocalizedLink(`/product/${item.slug}`, locale)}
                    className="shrink-0 w-24 md:w-32 aspect-[4/5] bg-section overflow-hidden"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link
                          {...getLocalizedLink(`/product/${item.slug}`, locale)}
                          className="font-display text-lg hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("common.size", locale)} {item.size} · {item.color}
                        </p>
                      </div>
                      <div className="text-sm">{formatLineMoney(item.priceGBP, item.qty)}</div>
                    </div>
                    <div className="mt-auto flex justify-between items-end">
                      <div className="flex items-center border border-border">
                        <button
                          onClick={() => setQty(item.slug, item.size, item.qty - 1, item.color)}
                          className="h-9 w-9 grid place-items-center"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.qty}</span>
                        <button
                          onClick={() => setQty(item.slug, item.size, item.qty + 1, item.color, stockByVariant[variantKey(item)])}
                          disabled={item.qty >= (stockByVariant[variantKey(item)] ?? Number.MAX_SAFE_INTEGER)}
                          className="h-9 w-9 grid place-items-center disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {stockByVariant[variantKey(item)] !== undefined && <span className="text-[10px] text-muted-foreground">{stockByVariant[variantKey(item)]} available</span>}
                      <button
                        onClick={() => removeFromCart(item.slug, item.size, item.color)}
                        className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("common.remove", locale)}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cart.length > 0 && (
          <aside className="bg-surface p-7 h-fit lg:sticky lg:top-28 space-y-4">
            <h2 className="font-display text-xl">{t("checkout.orderSummary", locale)}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.subtotal", locale)}</span>
                <span>{formatCartTotal(cart)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {locale === "it"
                    ? "Spedizione"
                    : locale === "de"
                      ? "Versand"
                      : locale === "fr"
                        ? "Livraison"
                        : locale === "es"
                          ? "Envío"
                          : "Shipping"}
                </span>
                <span>
                  {shipping === 0
                    ? locale === "it"
                      ? "Gratis"
                      : locale === "de"
                        ? "Kostenlos"
                        : locale === "fr"
                          ? "Gratuit"
                          : locale === "es"
                            ? "Gratis"
                            : "Free"
                    : formatGBP(shipping)}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-border font-display text-lg">
                <span>{t("common.total", locale)}</span>
                <span>{formatCartTotal(cart)}</span>
              </div>
            </div>
            <Link
              to={user ? `/${locale}/checkout` : `/${locale}/login`}
              search={user ? undefined : { returnTo: `/${locale}/checkout` }}
              onClick={() =>
                trackEvent("begin_checkout", {
                  currency: currency === "USD" ? "GBP" : currency,
                  value: total,
                  items: cart.map((item) => ({
                    item_id: item.slug,
                    item_name: item.name,
                    item_variant: `${item.color} / ${item.size}`,
                    price: item.priceGBP,
                    quantity: item.qty,
                  })),
                })
              }
              className="w-full h-12 bg-foreground text-background text-sm tracking-widest uppercase hover:bg-foreground/90 flex items-center justify-center"
            >
              {t("common.checkout", locale)}
            </Link>
            <p className="text-[11px] text-muted-foreground text-center">
              Tracked UK delivery options · See returns policy
            </p>
            <div className="border-t border-border pt-4 space-y-2 text-xs text-muted-foreground">
              <p>Availability and dispatch timing are confirmed with your order.</p>
              <p>Applicable taxes and delivery charges are shown during checkout.</p>
              <Link
                {...getLocalizedLink("/contact", locale)}
                className="inline-block underline underline-offset-2 text-foreground"
              >
                Need sizing or order help? Contact us.
              </Link>
            </div>
          </aside>
        )}
      </section>
    </>
  );
}
