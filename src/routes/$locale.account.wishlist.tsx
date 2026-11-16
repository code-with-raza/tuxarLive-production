import { getStorefrontProducts } from "@/lib/storefront-products";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Locale, getLocalizedProduct, getLocalizedLink } from "@/i18n/i18n";
import { useShop } from "@/store/shop";
import { type Product } from "@/data/products";
import { ProductCard } from "@/components/site/ProductCard";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/$locale/account/wishlist")({
  loader: () => getStorefrontProducts(),
  component: AccountWishlist,
});

function AccountWishlist() {
  const { locale } = Route.useParams() as { locale: Locale };
  const wishlist = useShop((s) => s.wishlist);
  const products = Route.useLoaderData() as Product[];
  const rawItems = products.filter((p) => wishlist.includes(p.slug));
  const items = rawItems.map((p) => getLocalizedProduct(p, locale));

  const shopLink = getLocalizedLink("/shop", locale);

  return (
    <div className="space-y-8 animate-luxe-fade-in">
      <div>
        <h1 className="font-display text-3xl mb-1">My Wishlist</h1>
        <p className="text-sm text-muted-foreground font-sans">
          Your curated collection of saved pieces.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 bg-surface">
          <Heart className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" strokeWidth={1} />
          <p className="text-sm text-muted-foreground font-sans mb-6">Your wishlist is empty.</p>
          <Link
            to={shopLink.to}
            params={shopLink.params}
            className="inline-block text-xs uppercase tracking-widest bg-foreground text-background px-6 py-3 font-sans font-semibold hover:bg-foreground/90 transition-colors"
          >
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-9 md:gap-x-5 md:gap-y-11">
          {items.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
