import { BusinessAddress } from "@/components/site/BusinessAddress";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Instagram, Facebook } from "lucide-react";
import { Logo } from "./Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale, t, getLocalizedSlug } from "@/i18n/i18n";
import { openCookieSettings } from "./CookieConsent";
import { toast } from "sonner";
import { isStripeEnabled } from "@/lib/payments";

export function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const { location } = useRouterState();
  const segments = location.pathname.split("/");
  const activeLocale = SUPPORTED_LOCALES.includes(segments[1] as Locale)
    ? (segments[1] as Locale)
    : DEFAULT_LOCALE;

  const submitNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setNewsletterLoading(true);
    try {
      const { isSupabaseConfigured, supabase } = await import("@/lib/supabase");
      if (!isSupabaseConfigured()) {
        toast.info("Newsletter signup will be available after deployment.");
        return;
      }
      const { error } = await supabase.functions.invoke("subscribe-newsletter", {
        body: { email, locale: activeLocale, website: "" },
      });
      if (error) throw error;
      setNewsletterEmail("");
      toast.success("You are subscribed to The Tuxar Letter.");
    } catch {
      toast.error("We could not save your subscription. Please try again later.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  const columns = [
    {
      title: t("footer.columns.shop", activeLocale) || "Shop",
      links: [
        { to: `/${activeLocale}/leather-jackets`, label: t("nav.jackets", activeLocale) },
        { to: `/${activeLocale}/motorcycle-suits`, label: t("nav.suits", activeLocale) },
        { to: `/${activeLocale}/leather-bags`, label: t("nav.bags", activeLocale) },
        { to: `/${activeLocale}/accessories`, label: t("nav.accessories", activeLocale) },
        { to: `/${activeLocale}/shop`, label: t("nav.shop", activeLocale) },
      ],
    },
    {
      title: t("footer.columns.collections", activeLocale) || "Collections",
      links: [
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("varsity-jackets", "collection", activeLocale)}`,
          label: t("collections.varsity-jackets.title", activeLocale) || "Varsity Jackets",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("textile-jackets", "collection", activeLocale)}`,
          label: t("collections.textile-jackets.title", activeLocale) || "Textile Jackets",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("bomber-jackets", "collection", activeLocale)}`,
          label: t("collections.bomber-jackets.title", activeLocale) || "Bomber Jackets",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("motorcycle-jackets", "collection", activeLocale)}`,
          label: t("collections.motorcycle-jackets.title", activeLocale) || "Motorcycle Jackets",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("cafe-racer-jackets", "collection", activeLocale)}`,
          label: t("collections.cafe-racer-jackets.title", activeLocale) || "Cafe Racers",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("touring-jackets", "collection", activeLocale)}`,
          label: t("collections.touring-jackets.title", activeLocale) || "Touring Jackets",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("leather-bags", "collection", activeLocale)}`,
          label: t("collections.leather-bags.title", activeLocale) || "Leather Bags",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("leather-accessories", "collection", activeLocale)}`,
          label: t("collections.leather-accessories.title", activeLocale) || "Leather Accessories",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("motorcycle-suits", "collection", activeLocale)}`,
          label: t("collections.motorcycle-suits.title", activeLocale) || "Motorcycle Suits",
        },
        {
          to: `/${activeLocale}/collections/${getLocalizedSlug("racing-jackets", "collection", activeLocale)}`,
          label: t("collections.racing-jackets.title", activeLocale) || "Racing Jackets",
        },
      ],
    },
    {
      title: t("footer.columns.atelier", activeLocale) || "Atelier",
      links: [
        { to: `/${activeLocale}/about`, label: t("nav.about", activeLocale) },
        { to: `/${activeLocale}/blog`, label: t("nav.blog", activeLocale) },
        {
          to: `/${activeLocale}/size-guide`,
          label:
            activeLocale === "it"
              ? "Guida Taglie"
              : activeLocale === "de"
                ? "Größentabelle"
                : activeLocale === "fr"
                  ? "Guide des Tailles"
                  : activeLocale === "es"
                    ? "Guía de Tallas"
                    : "Size Guide",
        },
        { to: `/${activeLocale}/contact`, label: t("nav.contact", activeLocale) },
      ],
    },
    {
      title: t("footer.columns.service", activeLocale) || "Service",
      links: [
        {
          to: `/${activeLocale}/shipping-policy`,
          label:
            activeLocale === "it"
              ? "Spedizione"
              : activeLocale === "de"
                ? "Versand"
                : activeLocale === "fr"
                  ? "Livraison"
                  : activeLocale === "es"
                    ? "Envío"
                    : "Shipping",
        },
        {
          to: `/${activeLocale}/returns-policy`,
          label:
            activeLocale === "it"
              ? "Resi & Riparazioni"
              : activeLocale === "de"
                ? "Rückgaben & Reparaturen"
                : activeLocale === "fr"
                  ? "Retours & Réparations"
                  : activeLocale === "es"
                    ? "Devoluciones y Arreglos"
                    : "Returns & Repairs",
        },
        { to: `/${activeLocale}/faq`, label: t("nav.faq", activeLocale) || "FAQ" },
        {
          to: `/${activeLocale}/terms-conditions`,
          label:
            activeLocale === "it"
              ? "Termini"
              : activeLocale === "de"
                ? "Bedingungen"
                : activeLocale === "fr"
                  ? "Conditions"
                  : activeLocale === "es"
                    ? "Términos"
                    : "Terms",
        },
        {
          to: `/${activeLocale}/privacy-policy`,
          label:
            activeLocale === "it"
              ? "Privacy"
              : activeLocale === "de"
                ? "Datenschutz"
                : activeLocale === "fr"
                  ? "Confidentialité"
                  : activeLocale === "es"
                    ? "Privacidad"
                    : "Privacy",
        },
      ],
    },
  ];

  return (
    <footer className="bg-foreground text-background mt-24 md:mt-32">
      <div className="container-luxe py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
          <div className="md:col-span-3">
            <Logo variant="light" size={45} />
            <p className="mt-6 max-w-md text-sm leading-relaxed text-background/70 font-sans">
              {t("footer.description", activeLocale)}
            </p>
            <div className="mt-6"><BusinessAddress locale={activeLocale}/></div>
            <form
              onSubmit={submitNewsletter}
              className="mt-8 flex max-w-md gap-2"
              aria-label="Newsletter signup"
            >
              <Input
                type="email"
                aria-label="Your email address"
                autoComplete="email"
                required
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                placeholder={
                  t("footer.newsletter.placeholder", activeLocale) || "Your email address"
                }
                className="bg-transparent border-background/30 text-background placeholder:text-background/50 focus-visible:ring-background font-sans"
              />
              <Button
                type="submit"
                disabled={newsletterLoading}
                className="bg-background text-foreground hover:bg-background/90 font-sans tracking-wider text-xs uppercase"
              >
                {newsletterLoading
                  ? "Saving…"
                  : t("footer.newsletter.submit", activeLocale) || "Subscribe"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-background/50 font-sans">
              {t("footer.newsletter.hint", activeLocale) ||
                "Receive lookbook drops and atelier invites. Unsubscribe anytime."}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <h4 className="eyebrow text-background/60 mb-5">{col.title}</h4>
              <ul className="space-y-3 text-sm">
                {col.links.map((l) => {
                  return (
                    <li key={l.label}>
                      <Link
                        to={l.to as any}
                        className="text-background/80 hover:text-background transition-colors font-sans"
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="md:col-span-1 flex md:flex-col gap-4 md:gap-3 md:items-end">
            <a
              href="https://www.instagram.com/tuxarofficial?igsh=NHQ4YXF5NHdkMXM0"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-background/70 hover:text-background"
            >
              <Instagram className="h-5 w-5" strokeWidth={1.4} />
            </a>
            <a
              href="https://www.facebook.com/tuxarofficial"
              aria-label="Facebook"
              target="_blank"
              className="text-background/70 hover:text-background target=_blank"
            >
              <Facebook className="h-5 w-5" strokeWidth={1.4} />
            </a>
            {/*<a href="#" aria-label="YouTube" className="text-background/70 hover:text-background">
              <Youtube className="h-5 w-5" strokeWidth={1.4} />
          </a>*/}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-background/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-background/55 font-sans">
          <p>
            © {new Date().getFullYear()}{" "}
            {t("footer.copyright", activeLocale) || "Tuxar"}
            {" · "}
            <a
              href="mailto:tuxar.co@gmail.com"
              className="text-background/80 hover:text-background transition-colors"
            >
              tuxar.co@gmail.com
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-sans">
            <button
              type="button"
              onClick={openCookieSettings}
              className="text-background/70 underline-offset-2 hover:text-background hover:underline"
            >
              Cookie settings
            </button>
            {isStripeEnabled && <span>Secure card payments</span>}
          </div>
        </div>
      </div>
    </footer>
  );
}
