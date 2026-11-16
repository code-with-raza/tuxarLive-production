import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { useUser } from "@/hooks/useUser";
import { useEffect } from "react";
import { Loader2, User, ShoppingBag, MapPin, Heart, Settings, LogOut } from "lucide-react";

export const Route = createFileRoute("/$locale/account")({
  head: () => ({
    meta: [{ title: "My Account — Tuxar" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AccountLayout,
});

function AccountLayout() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { user, isLoading, logout } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const storedReturnTo = sessionStorage.getItem("tuxar-auth-return-to");
    const safeStoredReturnTo = storedReturnTo?.startsWith(`/${locale}/`) ? storedReturnTo : null;
    if (!isLoading && !user) {
      const target = getLocalizedLink("/login", locale);
      navigate({ to: target.to, params: target.params, replace: true });
    } else if (!isLoading && user && !user.tuxarVerified) {
      navigate({
        to: `/${locale}/verify-email`,
        search: { returnTo: safeStoredReturnTo || `/${locale}/account` },
        replace: true,
      });
    } else if (
      !isLoading &&
      user?.tuxarVerified &&
      safeStoredReturnTo &&
      safeStoredReturnTo !== `/${locale}/account`
    ) {
      sessionStorage.removeItem("tuxar-auth-return-to");
      navigate({ to: safeStoredReturnTo, replace: true });
    }
  }, [user, isLoading, locale, navigate]);

  const handleLogout = async () => {
    await logout();
    const target = getLocalizedLink("/login", locale);
    navigate({ to: target.to, params: target.params, replace: true });
  };

  if (isLoading || !user || !user.tuxarVerified) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const links = [
    { to: "/account", label: "Dashboard", icon: User },
    { to: "/account/orders", label: "Orders", icon: ShoppingBag },
    { to: "/account/addresses", label: "Addresses", icon: MapPin },
    { to: "/account/wishlist", label: "Wishlist", icon: Heart },
    { to: "/account/profile", label: "Profile Settings", icon: Settings },
  ];

  return (
    <div className="container-luxe py-12 md:py-20 animate-luxe-fade-in">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
        <aside className="w-full lg:w-64 shrink-0">
          <div className="border border-border p-6 bg-surface">
            <div className="mb-6">
              <h2 className="font-display text-xl mb-1">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-xs text-muted-foreground font-sans truncate">{user.email}</p>
            </div>

            <nav className="flex flex-col gap-1">
              {links.map((link) => {
                const locLink = getLocalizedLink(link.to, locale);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={locLink.to as any}
                    params={locLink.params as any}
                    activeOptions={{ exact: link.to === "/account" }}
                    activeProps={{ className: "bg-foreground text-background" }}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs uppercase tracking-wider font-sans hover:bg-foreground hover:text-background transition-colors duration-200"
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                    {link.label}
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-xs uppercase tracking-wider font-sans text-destructive hover:bg-destructive hover:text-background transition-colors duration-200 mt-4 border-t pt-4 border-border text-left w-full cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
