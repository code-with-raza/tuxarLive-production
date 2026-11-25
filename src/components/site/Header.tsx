import { storefrontManagedCategories } from "@/lib/catalogCategories";
import { useMarketCurrency, localeCurrency, type Currency } from "@/lib/market";
import { useCartInventory } from "@/hooks/useCartInventory";
import { useEffect, useRef, useState } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import {
  Globe,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { useShop, cartCount } from "@/store/shop";
import { useUIStore } from "@/store/ui";
import { COLLECTIONS } from "@/data/products";
import { getAudienceCollection } from "@/lib/product-audience";
import { previewCollection } from "@/lib/catalogue-preview-edits";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import { saveLocale } from "@/i18n/preferred-locale";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
  resolveSlug,
  getLocalizedSlug,
  getLocalizedCollection,
  t,
} from "@/i18n/i18n";

// ─── Language config ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "de", label: "Deutschland" },
  { code: "en", label: "United Kingdom" },
  { code: "fr", label: "France" },
  { code: "it", label: "Italia" },
  { code: "es", label: "España" },
];

// ─── Mega-menu link type ──────────────────────────────────────────────────────

type MegaLink = { label: string; to: string; params?: Record<string, string>; search?: { audience: "men" | "women" } };

// ─── MEN mega-menu data ───────────────────────────────────────────────────────

function menLinks(locale: string): { col1: MegaLink[]; col2: MegaLink[] } {
  const col = (slug: string) => ({
    to: "/$locale/collections/$slug",
    params: { locale, slug: getLocalizedSlug(slug, "collection", locale as Locale) },
  });
  return {
    col1: [
      { label: "All Leather Jackets", to: `/${locale}/leather-jackets` },
      { label: "Featured", ...col("best-sellers") },
      { label: "Suede Jackets", ...col("suede-jackets") },
      { label: "Bomber Jackets", ...col("bomber-jackets") },
      { label: "Shearling Jackets", ...col("shearling-jackets") },
      { label: "Wool Jackets", ...col("wool-jackets") },
      { label: "Shearling Vests", ...col("shearling-vests") },
      { label: "Biker Jackets", ...col("biker-jackets") },
      { label: "Cafe Racer Jackets", ...col("cafe-racer-jackets") },
      { label: "Leather Vests", ...col("leather-vests") },
      { label: "Leather Puffer Jackets", ...col("leather-puffer-jackets") },
      { label: "Puffer Jackets", ...col("puffer-jackets") },
      { label: "Leather Puffer Vests", ...col("leather-puffer-vests") },
      { label: "Varsity Jackets", ...col("varsity-jackets") },
      { label: "Leather Blazers", ...col("leather-blazers") },
      { label: "Aviator Jackets", ...col("aviator-jackets") },
      { label: "Oversize Leather Jackets", ...col("oversize-leather-jackets") },
      { label: "Leather Pants", ...col("leather-pants") },
      { label: "Leather Shirts", ...col("leather-shirts") },
      { label: "Motorbike Jackets", ...col("motorcycle-jackets") },
      { label: "Motorbike Suits", to: `/${locale}/motorcycle-suits` },
    ],
    col2: [
      { label: "Leather Coats", ...col("leather-coats") },
      { label: "Leather Trench Coats", ...col("leather-trench-coats") },
      { label: "Shearling Coats", ...col("shearling-coats") },
      { label: "Wool Coats", ...col("wool-coats") },
    ],
  };
}

// ─── WOMEN mega-menu data ─────────────────────────────────────────────────────

function womenLinks(locale: string): {
  col1: MegaLink[];
  col2: MegaLink[];
  col3: MegaLink[];
} {
  const col = (slug: string) => {
    const womenSlug = slug.startsWith("women-") || ["cropped-jackets", "leather-fur-jackets"].includes(slug)
      ? slug : `women-${slug}`;
    return {
      to: "/$locale/collections/$slug",
      params: { locale, slug: getLocalizedSlug(womenSlug, "collection", locale as Locale) },
    };
  };
  return {
    col1: [
      { label: "All Leather Jackets", to: `/${locale}/women-leather-jackets` },
      { label: "Leather Jackets", ...col("women-leather-jackets") },
      { label: "Featured", ...col("best-sellers") },
      { label: "Suede Jackets", ...col("suede-jackets") },
      { label: "Bomber Jackets", ...col("bomber-jackets") },
      { label: "Leather Puffer Jackets", ...col("leather-puffer-jackets") },
      { label: "Cat Top Jacket", ...col("women-puffer-jackets") },
      { label: "Leather Puffer Vests", ...col("leather-puffer-vests") },
      { label: "Cropped Leather Jackets", ...col("cropped-jackets") },
      { label: "zipper jacket", ...col("women-shearling-jackets") },
      { label: "Wool Jackets", ...col("wool-jackets") },
      { label: "Shearling Vests", ...col("shearling-vests") },
      { label: "Biker Jackets", ...col("women-biker-jackets") },
      { label: "sperade collar jacket", ...col("women-racing-jackets") },
      { label: "Leather Vests", ...col("leather-vests") },
      { label: "Leather Hood Jackets", ...col("women-varsity-jackets") },
      { label: "Leather Blazers", ...col("women-leather-blazers") },
      { label: "Leather Round Jackets", ...col("women-aviator-jackets") },
      { label: "Oversize Leather Jackets", ...col("oversize-leather-jackets") },
      { label: "Leather Pants", ...col("leather-pants") },
      { label: "Leather Shirts", ...col("leather-shirts") },
      { label: "Motorcycle Jackets", ...col("women-motorcycle-jackets") },
      { label: "Motorcycle Tops", ...col("women-motorcycle-suits") },
    ],
    col2: [
      { label: "Leather Coats", ...col("women-leather-coats") },
      { label: "Leather Trench Coats", ...col("leather-trench-coats") },
      { label: "Shearling Coats", ...col("shearling-coats") },
      { label: "Wool Coats", ...col("wool-coats") },
    ],
    col3: [
      { label: "Leather Skirts", ...col("leather-skirts") },
      { label: "Leather Shorts", ...col("leather-shorts") },
      { label: "Skirts", ...col("skirts") },
      { label: "Pants", ...col("leather-pants") },
      { label: "LEATHER FUR JACKETS", ...col("leather-fur-jackets") },
    ],
  };
}

// ─── Announcement bar ─────────────────────────────────────────────────────────

export function AnnouncementBar({ locale }: { locale: Locale }) {
  return (
    <div className="bg-foreground text-background text-[11px] tracking-[0.18em] uppercase font-sans">
      <div className="container-luxe flex h-8 items-center justify-center gap-6 overflow-hidden">
        <span>{t("announcement.shipping", locale)}</span>
        <span className="hidden md:inline opacity-60">·</span>
        <span className="hidden md:inline">{t("announcement.services", locale)}</span>
      </div>
    </div>
  );
}

// ─── Mega-menu link ───────────────────────────────────────────────────────────

function MegaNavLink({ link, onClose }: { link: MegaLink; onClose: () => void }) {
  return (
    <Link
      to={link.to as any}
      params={link.params as any}
      search={link.search as any}
      onClick={onClose}
      className="group flex items-center justify-between py-2.5 border-b border-border/30 hover:pl-2 transition-all duration-200"
    >
      <span className="text-[11px] tracking-wider uppercase text-foreground/70 group-hover:text-foreground transition-colors duration-150">
        {link.label}
      </span>
      <span className="text-foreground/20 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-200 text-xs opacity-0 group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const cart = useShop((s) => s.cart);
  useCartInventory(cart);
  const wishlist = useShop((s) => s.wishlist);
  const setQty = useShop((s) => s.setQty);
  const removeFromCart = useShop((s) => s.removeFromCart);
  const isCartOpen = useUIStore((s) => s.isCartOpen);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const { user } = useUser();

  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Mobile accordion state
  const [mobileMenOpen, setMobileMenOpen] = useState(false);
  const [mobileWomenOpen, setMobileWomenOpen] = useState(false);
  // Desktop mega-menu state
  const [megaMenu, setMegaMenu] = useState<"men" | "women" | null>(null);
  const [managedCategories,setManagedCategories]=useState<Array<{name:string;slug:string;audience:string}>>([]);
  useEffect(()=>{void supabase.from("product_categories").select("name,slug,audience").eq("status","active").order("position").then(({data})=>setManagedCategories(data??[]));},[]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = (menu: "men" | "women") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaMenu(menu);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setMegaMenu(null), 120);
  };

  const router = useRouter();
  const state = useRouterState();
  const { location } = state;

  // Resolve active locale from URL
  const segments = location.pathname.split("/");
  const activeLocale = SUPPORTED_LOCALES.includes(segments[1] as Locale)
    ? (segments[1] as Locale)
    : DEFAULT_LOCALE;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setMegaMenu(null);
    setSearchOpen(false);
    setCartOpen(false);
  }, [location.pathname, setCartOpen]);

  // Escape closes mega-menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMegaMenu(null);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const count = cartCount(cart);

  const changeLanguage = (newLocale: Locale) => {
    saveLocale(newLocale);
    if (activeLocale === newLocale) return;

    const currentMatch = state.matches[state.matches.length - 1];
    const currentParams = currentMatch?.params as any;
    const pathParts = [...segments];
    pathParts[1] = newLocale;

    if (currentParams?.slug) {
      if (location.pathname.includes("/product/")) {
        const canonical = resolveSlug(currentParams.slug, "product", activeLocale);
        pathParts[3] = getLocalizedSlug(canonical, "product", newLocale);
      } else if (location.pathname.includes("/blog/")) {
        const canonical = resolveSlug(currentParams.slug, "blog", activeLocale);
        const post = (currentMatch?.loaderData as { post?: { translations?: Partial<Record<Locale, string>> } } | undefined)?.post;
        if (post?.translations) {
          const translated = post.translations[newLocale];
          if (translated) pathParts[3] = translated;
          else pathParts.splice(3); // A review draft is not a published language page.
        } else pathParts[3] = getLocalizedSlug(canonical, "blog", newLocale);
      } else if (location.pathname.includes("/collections/")) {
        const canonical = resolveSlug(currentParams.slug, "collection", activeLocale);
        pathParts[3] = getLocalizedSlug(canonical, "collection", newLocale);
      }
    }

    router.navigate({ to: pathParts.join("/"), search: state.location.search });
  };

  const market = useMarketCurrency(activeLocale);
  const { currency, setCurrency, formatLineMoney, formatCartTotal } = market;
  const men = menLinks(activeLocale);
  const women = womenLinks(activeLocale);
  const managed=(audience: "men" | "women")=>storefrontManagedCategories(managedCategories, audience).map(category=>{
    const collection = getAudienceCollection(category.slug, category.name, audience, COLLECTIONS);
    return {label:collection && ["women-aviator-jackets", "women-varsity-jackets", "women-racing-jackets", "women-shearling-jackets", "women-puffer-jackets"].includes(collection.slug) ? collection.title : category.name,to:audience==="women" && category.slug==="leather-jackets" ? `/${activeLocale}/women-leather-jackets`
      : audience==="women" && collection ? `/${activeLocale}/collections/${getLocalizedSlug(collection.slug, "collection", activeLocale as Locale)}`
      : `/${activeLocale}/${category.slug}`,search:audience==="women"?{audience:"women" as const}:undefined};
  });
  // Database categories can duplicate the built-in collection links.
  const appendUnique = (menu: ReturnType<typeof menLinks>, additions: MegaLink[]) => {
    const links = Object.values(menu).flat();
    const key = (link: MegaLink) => link.params?.slug ?? link.to.split("/").at(-1);
    const destinations = new Set(links.map(key));
    const labels = new Set(links.map(link => link.label.trim().toLowerCase()));
    for (const link of additions) {
      const label = link.label.trim().toLowerCase();
      if (destinations.has(key(link)) || labels.has(label)) continue;
      menu.col1.push(link); destinations.add(key(link)); labels.add(label);
    }
  };
  appendUnique(men, managed("men"));
  appendUnique(women, managed("women"));
  for (const menu of [men, women]) for (const links of Object.values(menu)) for (const link of links) {
    const source = COLLECTIONS.find(collection => getLocalizedSlug(collection.slug, "collection", activeLocale as Locale) === link.params?.slug || link.to.endsWith(`/collections/${getLocalizedSlug(collection.slug, "collection", activeLocale as Locale)}`));
    if (source) link.label = getLocalizedCollection(source,activeLocale as Locale).title;
    else if (link.to.endsWith('/women-leather-jackets')) link.label = t('nav.womenJackets',activeLocale);
    else if (link.to.endsWith('/leather-jackets')) link.label = t('nav.jackets',activeLocale);
    else if (link.to.endsWith('/motorcycle-suits')) link.label = t('nav.suits',activeLocale);
  }

  const navBtn = (id: string, label: string, mega: "men" | "women") => (
    <Link
      to={`/${activeLocale}/${mega === "women" ? "women-leather-jackets" : "leather-jackets"}`}
      key={id}
      id={`mega-${id}-trigger`}
      onMouseEnter={() => openMenu(mega)}
      onMouseLeave={scheduleClose}
      onFocus={() => openMenu(mega)}
      onClick={() => setMegaMenu(null)}
      aria-haspopup="true"
      aria-expanded={megaMenu === mega}
      aria-controls={`mega-${id}-panel`}
      className={`luxe-nav-link py-1 transition-colors cursor-pointer text-[13px] tracking-[0.14em] uppercase font-sans ${
        megaMenu === mega ? "text-foreground" : "text-foreground/80 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  const navLink =
    "luxe-nav-link py-1 text-[13px] tracking-[0.14em] uppercase font-sans text-foreground/80 hover:text-foreground transition-colors";

  return (
    <>
      <AnnouncementBar locale={activeLocale} />

      <header
        className={`sticky top-0 z-50 w-full border-b transition-colors duration-300 ${
          scrolled
            ? "bg-background/90 backdrop-blur-md border-border"
            : "bg-background border-transparent"
        }`}
      >
        {/*
          ── Flex + absolute center ────────────────────────────────────────────
          The entire MEN WOMEN SALES [LOGO] BRANDS JOURNAL ATELIER block sits
          in one div that is absolutely centered (left-1/2 -translate-x-1/2).
          Icons stay at the right edge via ml-auto.
          The logo is therefore always at the visual center of the header.
        */}
        <div className="container-luxe relative flex items-center h-16 md:h-20">
          {/* ── Mobile: hamburger (left edge) ───────────────────────── */}
          <div className="lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button aria-label="Open menu" className="-ml-2 p-2 text-foreground">
                  <Menu className="h-5 w-5" strokeWidth={1.4} />
                </button>
              </SheetTrigger>

              <SheetContent
                side="left"
                showCloseButton={false}
                className="w-[85vw] sm:w-[380px] p-0 flex flex-col justify-between overflow-y-auto"
              >
                <div>
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse product categories, account links, language and currency options.
                  </SheetDescription>

                  <div className="flex items-center justify-between px-6 h-16 border-b">
                    <Link to="/$locale" params={{ locale: activeLocale } as any}>
                      <Logo />
                    </Link>
                    <button onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-11 w-11 items-center justify-center">
                      <X className="h-5 w-5" strokeWidth={1.4} />
                    </button>
                  </div>

                  <nav className="flex flex-col py-4">
                    {/* MEN */}
                    <div className="flex flex-col border-b border-border/60">
                      <div className="flex items-center pr-4">
                      <Link to={`/${activeLocale}/leather-jackets`} onClick={() => setOpen(false)} className="flex-1 px-6 py-3 font-display text-xl hover:bg-section">{t('nav.men',activeLocale)}</Link>
                      <button
                        aria-label="Toggle men's categories"
                        onClick={() => setMobileMenOpen(!mobileMenOpen)}
                        className="inline-flex h-11 w-11 items-center justify-center hover:bg-section"
                        aria-expanded={mobileMenOpen}
                      >
                        <span className="text-sm font-sans text-muted-foreground">
                          {mobileMenOpen ? "−" : "+"}
                        </span>
                      </button>
                      </div>
                      {mobileMenOpen && (
                        <div className="bg-section pl-6 py-2 flex flex-col">
                          <p className="px-6 py-1.5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
                            Leather Jackets
                          </p>
                          {men.col1.map((link) => (
                            <Link
                              key={link.label}
                              to={link.to as any}
                              params={link.params as any}
                              onClick={() => setOpen(false)}
                              className="px-6 py-2 text-sm uppercase tracking-wider text-foreground/80 hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          ))}
                          <p className="px-6 pt-3 pb-1.5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
                            Coats
                          </p>
                          {men.col2.map((link) => (
                            <Link
                              key={link.label}
                              to={link.to as any}
                              params={link.params as any}
                              onClick={() => setOpen(false)}
                              className="px-6 py-2 text-sm uppercase tracking-wider text-foreground/80 hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* WOMEN */}
                    <div className="flex flex-col border-b border-border/60">
                      <div className="flex items-center pr-4">
                      <Link to={`/${activeLocale}/women-leather-jackets`} onClick={() => setOpen(false)} className="flex-1 px-6 py-3 font-display text-xl hover:bg-section">{t('nav.women',activeLocale)}</Link>
                      <button
                        aria-label="Toggle women's categories"
                        onClick={() => setMobileWomenOpen(!mobileWomenOpen)}
                        className="inline-flex h-11 w-11 items-center justify-center hover:bg-section"
                        aria-expanded={mobileWomenOpen}
                      >
                        <span className="text-sm font-sans text-muted-foreground">
                          {mobileWomenOpen ? "−" : "+"}
                        </span>
                      </button>
                      </div>
                      {mobileWomenOpen && (
                        <div className="bg-section pl-6 py-2 flex flex-col">
                          <p className="px-6 py-1.5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
                            Jackets & Leather
                          </p>
                          {women.col1.map((link) => (
                            <Link
                              key={link.label}
                              to={link.to as any}
                              params={link.params as any}
                              search={link.search as any}
                              onClick={() => setOpen(false)}
                              className="px-6 py-2 text-sm uppercase tracking-wider text-foreground/80 hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          ))}
                          <p className="px-6 pt-3 pb-1.5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
                            Coats
                          </p>
                          {women.col2.map((link) => (
                            <Link
                              key={link.label}
                              to={link.to as any}
                              params={link.params as any}
                              onClick={() => setOpen(false)}
                              className="px-6 py-2 text-sm uppercase tracking-wider text-foreground/80 hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          ))}
                          <p className="px-6 pt-3 pb-1.5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
                            Skirts & Shorts
                          </p>
                          {women.col3.map((link) => (
                            <Link
                              key={link.label}
                              to={link.to as any}
                              params={link.params as any}
                              onClick={() => setOpen(false)}
                              className="px-6 py-2 text-sm uppercase tracking-wider text-foreground/80 hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SALES */}
                    <Link
                      to={`/${activeLocale}/sales` as any}
                      onClick={() => setOpen(false)}
                      className="px-6 py-3 font-display text-xl border-b border-border/60 hover:bg-section"
                    >
                      {t('nav.sales',activeLocale)}
                    </Link>

                    {/* CONTACT */}
                    <Link
                      to={`/${activeLocale}/contact` as any}
                      onClick={() => setOpen(false)}
                      className="px-6 py-3 font-display text-xl border-b border-border/60 hover:bg-section"
                    >
                      Contact
                    </Link>

                    {/* JOURNAL */}
                    <Link
                      to={`/${activeLocale}/blog` as any}
                      onClick={() => setOpen(false)}
                      className="px-6 py-3 font-display text-xl border-b border-border/60 hover:bg-section"
                    >
                      Journal
                    </Link>

                    {/* ATELIER */}
                    <Link
                      to={`/${activeLocale}/about` as any}
                      onClick={() => setOpen(false)}
                      className="px-6 py-3 font-display text-xl border-b border-border/60 hover:bg-section"
                    >
                      Atelier
                    </Link>
                  </nav>

                  <div className="px-6 py-6 space-y-3 text-sm">
                    <Link
                      to="/$locale/wishlist"
                      params={{ locale: activeLocale }}
                      className="block hover:underline"
                    >
                      {t("nav.wishlist", activeLocale)} ({wishlist.length})
                    </Link>
                    <Link
                      to="/$locale/cart"
                      params={{ locale: activeLocale }}
                      className="block hover:underline"
                    >
                      {t("nav.cart", activeLocale)} ({count})
                    </Link>
                    <Link
                      to="/$locale/contact"
                      params={{ locale: activeLocale }}
                      className="block hover:underline"
                    >
                      {t("nav.contact", activeLocale)}
                    </Link>
                    <Link
                      to="/$locale/faq"
                      params={{ locale: activeLocale }}
                      className="block hover:underline"
                    >
                      {t("nav.faq", activeLocale)}
                    </Link>
                  </div>
                </div>

                {/* Mobile preferences stay in the drawer, away from the centred header logo. */}
                <div className="shrink-0 border-t border-border p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-sans">
                    <Globe className="h-4 w-4" /> Language
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => changeLanguage(l.code as Locale)}
                        className={`text-xs uppercase font-semibold px-2 py-1 border transition font-sans ${
                          activeLocale === l.code
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-foreground/70"
                        }`}
                      >
                        {l.code}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="mobile-currency" className="text-xs uppercase tracking-widest text-muted-foreground font-sans">Currency</label>
                  <select id="mobile-currency" value={currency} onChange={event => setCurrency(event.target.value as Currency)} className="h-11 min-w-32 rounded-none border border-border bg-background px-3 text-sm" title={currency === "USD" ? market.usdRateInfo : "Payment currency"}>
                    <option value="GBP">GBP £</option><option value="EUR">EUR €</option><option value="USD">USD $</option>
                  </select>
                </div>
                {currency === "USD" && <CurrencyRateStatus market={market} />}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* ── Mobile: centered logo ────────────────────────────────── */}
          <Link
            to="/$locale"
            params={{ locale: activeLocale } as any}
            aria-label="Tuxar home"
            className="lg:hidden absolute left-1/2 -translate-x-1/2"
          >
            <Logo />
          </Link>

          {/* ── Desktop: [MEN WOMEN SALES] [LOGO] [BRANDS JOURNAL ATELIER]
               One div, absolutely centered at 50% of the header.
               Logo sits naturally in the middle of the flex row.        */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8 absolute left-1/2 -translate-x-1/2">
            {/* Left nav */}
            <nav className="flex items-center gap-6 xl:gap-8" aria-label="Left navigation">
              {navBtn("men", t('nav.men',activeLocale), "men")}
              {navBtn("women", t('nav.women',activeLocale), "women")}
              <Link to={`/${activeLocale}/sales` as any} className={navLink}>
                {t('nav.sales',activeLocale)}
              </Link>
            </nav>

            {/* Logo */}
            <Link
              to="/$locale"
              params={{ locale: activeLocale } as any}
              aria-label="Tuxar home"
              className="flex items-center px-2 md:px-4 shrink-0"
            >
              <Logo />
            </Link>

            {/* Right nav */}
            <nav className="flex items-center gap-6 xl:gap-8" aria-label="Right navigation">
              <Link to={`/${activeLocale}/contact` as any} className={navLink}>
                {t('nav.contact',activeLocale)}
              </Link>
              <Link to={`/${activeLocale}/blog` as any} className={navLink}>
                {t('nav.blog',activeLocale)}
              </Link>
              <Link to={`/${activeLocale}/about` as any} className={navLink}>
                {t('nav.about',activeLocale)}
              </Link>
            </nav>
          </div>

          {/* ── Icons: always at right edge ─────────────────────────── */}
          <div className="ml-auto flex items-center gap-0.5">
            <div className="hidden lg:block relative"><select aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value as Currency)} className="hidden lg:block h-10 bg-transparent px-1 text-xs" title={currency === "USD" ? market.usdRateInfo : "Payment currency"}>
              <option value="GBP">GBP £</option><option value="EUR">EUR €</option><option value="USD">USD $</option>
            </select>
            {currency === "USD" && !market.currencyReady && <div className="absolute right-0 top-full z-50 w-64 border bg-background p-3 shadow-lg"><CurrencyRateStatus market={market} /></div>}
            </div>
            {/* Language dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="luxe-icon-button hidden sm:inline-flex items-center gap-1 p-2 text-[11px] tracking-[0.18em] uppercase text-foreground/70 hover:text-foreground font-sans cursor-pointer"
                  aria-label="Language"
                >
                  <Globe className="h-4 w-4" strokeWidth={1.4} />
                  <span className="hidden lg:inline">{activeLocale.toUpperCase()}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px] font-sans">
                {LANGUAGES.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => changeLanguage(l.code as Locale)}
                    className="text-sm cursor-pointer"
                  >
                    <span className="w-8 uppercase tracking-widest text-xs text-muted-foreground">
                      {l.code}
                    </span>
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-expanded={searchOpen}
              className="luxe-icon-button p-2 text-foreground/80 hover:text-foreground"
            >
              <Search className="h-5 w-5" strokeWidth={1.4} />
            </button>

            {/* Wishlist */}
            <Link
              to="/$locale/wishlist"
              params={{ locale: activeLocale }}
              aria-label="Wishlist"
              className="luxe-icon-button relative p-2 text-foreground/80 hover:text-foreground"
            >
              <Heart className="h-5 w-5" strokeWidth={1.4} />
              {wishlist.length > 0 && (
                <span className="animate-luxe-count absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            {/* Account */}
            <Link
              to={(user ? `/${activeLocale}/account` : `/${activeLocale}/login`) as any}
              aria-label="Account"
              className="luxe-icon-button hidden sm:inline-flex p-2 text-foreground/80 hover:text-foreground"
            >
              <User className="h-5 w-5" strokeWidth={1.4} />
            </Link>

            {/* Cart */}
            <Sheet open={isCartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Cart"
                  className="luxe-icon-button relative p-2 text-foreground/80 hover:text-foreground"
                >
                  <ShoppingBag className="h-5 w-5" strokeWidth={1.4} />
                  {count > 0 && (
                    <span
                      key={count}
                      aria-live="polite"
                      className="animate-luxe-count absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center"
                    >
                      {count}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
                <div className="border-b border-border px-6 py-6">
                  <SheetTitle className="font-display text-2xl font-normal">
                    {t("nav.cart", activeLocale)} ({count})
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Review the products in your shopping bag and continue to checkout.
                  </SheetDescription>
                </div>

                {cart.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                    <ShoppingBag className="mb-5 h-8 w-8 text-muted-foreground" strokeWidth={1.1} />
                    <p className="font-display text-xl">{t("cartDrawer.empty", activeLocale)}</p>
                    <Link
                      to="/$locale/shop"
                      params={{ locale: activeLocale }}
                      onClick={() => setCartOpen(false)}
                      className="luxe-button mt-7 inline-flex h-11 items-center bg-foreground px-6 text-[11px] uppercase tracking-widest text-background"
                    >
                      {t("nav.shop", activeLocale)}
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                      {cart.map((item) => (
                        <div key={`${item.slug}-${item.size}`} className="flex gap-4">
                          <Link
                            to="/$locale/product/$slug"
                            params={{ locale: activeLocale, slug: item.slug }}
                            onClick={() => setCartOpen(false)}
                            className="h-28 w-24 shrink-0 overflow-hidden bg-section"
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-display leading-snug">{item.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.size} · {item.color}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.slug, item.size)}
                                aria-label={`Remove ${item.name}`}
                                className="luxe-icon-button -mr-2 p-2 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.3} />
                              </button>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center border border-border">
                                <button
                                  type="button"
                                  onClick={() => setQty(item.slug, item.size, item.qty - 1)}
                                  aria-label="Decrease quantity"
                                  className="grid h-8 w-8 place-items-center"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-7 text-center text-xs">{item.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setQty(item.slug, item.size, item.qty + 1)}
                                  aria-label="Increase quantity"
                                  className="grid h-8 w-8 place-items-center"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-sm">{formatLineMoney(item.priceGBP, item.qty)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border bg-surface px-6 py-6">
                      <div className="mb-5 flex items-center justify-between">
                        <span className="text-sm uppercase tracking-widest">
                          {t("cartDrawer.subtotal", activeLocale)}
                        </span>
                        <span className="font-display text-xl">
                          {formatCartTotal(cart)}
                        </span>
                      </div>
                      <Link
                        to={user ? `/${activeLocale}/checkout` : `/${activeLocale}/login`}
                        search={user ? undefined : { returnTo: `/${activeLocale}/checkout` }}
                        onClick={() => setCartOpen(false)}
                        className="luxe-button flex h-12 w-full items-center justify-center bg-foreground text-xs uppercase tracking-widest text-background"
                      >
                        {t("cartDrawer.checkout", activeLocale)}
                      </Link>
                      <Link
                        to="/$locale/cart"
                        params={{ locale: activeLocale }}
                        onClick={() => setCartOpen(false)}
                        className="mt-4 block text-center text-xs uppercase tracking-widest underline underline-offset-4"
                      >
                        {t("cartDrawer.viewBag", activeLocale)}
                      </Link>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* ── Desktop mega-menu panels ──────────────────────────────────────── */}

        {/* MEN panel */}
        {megaMenu === "men" && (
          <div
            id="mega-men-panel"
            role="region"
            aria-label="Men's collections"
            onMouseEnter={() => openMenu("men")}
            onMouseLeave={scheduleClose}
            className="animate-luxe-menu hidden lg:block absolute left-0 right-0 bg-background border-b border-border z-40 shadow-sm"
          >
            <div className="container-luxe py-8 grid grid-cols-[3fr_1fr] gap-12">
              <div>
                <p className="mb-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans font-medium">
                  Leather Jackets
                </p>
                <div className="grid grid-cols-3 gap-x-6">
                  {men.col1.map((link) => (
                    <MegaNavLink key={link.label} link={link} onClose={() => setMegaMenu(null)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans font-medium">
                  Coats
                </p>
                <div className="flex flex-col">
                  {men.col2.map((link) => (
                    <MegaNavLink key={link.label} link={link} onClose={() => setMegaMenu(null)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WOMEN panel */}
        {megaMenu === "women" && (
          <div
            id="mega-women-panel"
            role="region"
            aria-label="Women's collections"
            onMouseEnter={() => openMenu("women")}
            onMouseLeave={scheduleClose}
            className="animate-luxe-menu hidden lg:block absolute left-0 right-0 bg-background border-b border-border z-40 shadow-sm"
          >
            <div className="container-luxe py-8 grid grid-cols-[3fr_1fr_1fr] gap-10">
              <div>
                <p className="mb-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans font-medium">
                  Jackets & Leather
                </p>
                <div className="grid grid-cols-3 gap-x-6">
                  {women.col1.map((link) => (
                    <MegaNavLink key={link.label} link={link} onClose={() => setMegaMenu(null)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans font-medium">
                  Coats
                </p>
                <div className="flex flex-col">
                  {women.col2.map((link) => (
                    <MegaNavLink key={link.label} link={link} onClose={() => setMegaMenu(null)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans font-medium">
                  Skirts & Shorts
                </p>
                <div className="flex flex-col">
                  {women.col3.map((link) => (
                    <MegaNavLink key={link.label} link={link} onClose={() => setMegaMenu(null)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </header>

      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search Tuxar"
          className="animate-luxe-search fixed inset-0 z-[80] bg-background/96 backdrop-blur-xl"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSearchOpen(false);
          }}
        >
          <div className="container-luxe flex min-h-full flex-col">
            <div className="flex h-24 items-center justify-between border-b border-border">
              <Logo />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="luxe-icon-button p-3"
                aria-label="Close search"
              >
                <X className="h-6 w-6" strokeWidth={1.2} />
              </button>
            </div>
            <form
              action={`/${activeLocale}/shop`}
              method="get"
              className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-16"
            >
              <label htmlFor="site-search" className="eyebrow mb-6">
                {t("nav.shop", activeLocale)}
              </label>
              <div className="flex items-center border-b border-foreground/35 transition-colors focus-within:border-foreground">
                <input
                  id="site-search"
                  name="q"
                  type="search"
                  autoFocus
                  autoComplete="off"
                  placeholder={t("nav.search", activeLocale)}
                  className="h-20 min-w-0 flex-1 bg-transparent font-display text-3xl outline-none placeholder:text-foreground/25 md:h-28 md:text-6xl"
                />
                <button
                  type="submit"
                  className="luxe-icon-button grid h-14 w-14 place-items-center md:h-16 md:w-16"
                  aria-label="Submit search"
                >
                  <Search className="h-6 w-6 md:h-8 md:w-8" strokeWidth={1.1} />
                </button>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                {t("nav.jackets", activeLocale)} · {t("nav.suits", activeLocale)} ·{" "}
                {t("nav.bags", activeLocale)} · {t("nav.accessories", activeLocale)}
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function CurrencyRateStatus({ market }: { market: ReturnType<typeof useMarketCurrency> }) {
  return <div role="status" className="text-xs text-muted-foreground">
    {market.usdRateError || market.usdRateInfo}
    {market.usdRateError && <button type="button" className="ml-2 underline min-h-11" onClick={() => void market.refreshUsdPricing()}>Refresh USD pricing</button>}
  </div>;
}
