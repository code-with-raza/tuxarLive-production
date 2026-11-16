import { createFileRoute, Link } from "@tanstack/react-router";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";
import { Plus, ShoppingBag, MapPin } from "lucide-react";

export const Route = createFileRoute("/$locale/account/")({
  component: AccountIndex,
});

function AccountIndex() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { user } = useUser();

  const orderLink = getLocalizedLink("/account/orders", locale);
  const addressLink = getLocalizedLink("/account/addresses", locale);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl mb-1">Welcome back, {user?.firstName || "Client"}</h1>
        <p className="text-sm text-muted-foreground font-sans">
          From your account dashboard you can view your recent orders, manage shipping/billing
          addresses, and edit your profile.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="border border-border p-6 bg-surface">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display text-lg tracking-tight flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" strokeWidth={1.4} />
              Recent Orders
            </h3>
            <Link
              to={orderLink.to}
              params={orderLink.params}
              className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground font-sans font-medium underline underline-offset-4"
            >
              View All
            </Link>
          </div>

          <div className="text-center py-8 border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground font-sans mb-4">
              You have not placed any orders yet.
            </p>
            <Link
              to={getLocalizedLink("/shop", locale).to}
              params={getLocalizedLink("/shop", locale).params}
              className="inline-block text-[11px] uppercase tracking-widest bg-foreground text-background px-4 py-2 font-sans font-semibold hover:bg-foreground/90 transition-colors"
            >
              Explore Shop
            </Link>
          </div>
        </div>

        <div className="border border-border p-6 bg-surface">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display text-lg tracking-tight flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" strokeWidth={1.4} />
              Primary Address
            </h3>
            <Link
              to={addressLink.to}
              params={addressLink.params}
              className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground font-sans font-medium underline underline-offset-4"
            >
              Manage
            </Link>
          </div>

          <div className="text-center py-8 border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground font-sans mb-4">No addresses saved yet.</p>
            <Link
              to={addressLink.to}
              params={addressLink.params}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest bg-foreground text-background px-4 py-2 font-sans font-semibold hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Address
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
