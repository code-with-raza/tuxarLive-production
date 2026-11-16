import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/site/CookieConsent";

function NotFoundComponent() {
  useEffect(() => {
    const previousTitle = document.title;
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = existingRobots?.content;
    const robots = existingRobots ?? document.createElement("meta");

    document.title = "Page not found — Tuxar";
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    if (!existingRobots) document.head.appendChild(robots);

    return () => {
      document.title = previousTitle;
      if (existingRobots && previousRobots !== undefined) existingRobots.content = previousRobots;
      else robots.remove();
    };
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-4">404</p>
        <h1 className="font-display text-5xl md:text-6xl">Page not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you're looking for has moved or no longer exists.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center bg-foreground px-6 text-sm tracking-widest uppercase text-background hover:bg-foreground/90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content;
    const robots = existing ?? document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    if (!existing) document.head.appendChild(robots);
    return () => {
      if (existing && previous !== undefined) existing.content = previous;
      else robots.remove();
    };
  }, []);
  useEffect(() => {
    if (import.meta.env.DEV) console.error("Root Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">This page didn't load</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center justify-center bg-foreground px-5 text-sm tracking-widest uppercase text-background hover:bg-foreground/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center border border-foreground px-5 text-sm tracking-widest uppercase text-foreground hover:bg-section"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Tuxar" },
      { name: "theme-color", content: "#FFFFFF" },
      { property: "og:site_name", content: "Tuxar" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_GB" },
      { property: "og:locale:alternate", content: "de_DE" },
      { property: "og:locale:alternate", content: "fr_FR" },
      { property: "og:locale:alternate", content: "it_IT" },
      { property: "og:locale:alternate", content: "es_ES" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@tuxar" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://res.cloudinary.com" },
      { rel: "dns-prefetch", href: "https://res.cloudinary.com" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Tuxar",
          url: "https://tuxar.co.uk",
          email: "tuxar.co@gmail.com",
          sameAs: [
            "https://www.instagram.com/tuxarofficial",
            "https://www.facebook.com/tuxarofficial",
          ],
          contactPoint: {
            "@type": "ContactPoint",
            email: "tuxar.co@gmail.com",
            telephone: "+39 345 718 4353",
            contactType: "customer service",
            availableLanguage: ["en", "de", "fr", "it", "es"],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Tuxar",
          alternateName: "Tuxar.co.uk",
          url: "https://tuxar.co.uk",
        }),
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // Recheck public catalogue data after returning from another tab (e.g. the admin editor).
    const refresh = () => {
      if (!/\/(admin|account|checkout|confirmation|login|register)(\/|$)/.test(router.state.location.pathname)) {
        void router.invalidate();
      }
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <CookieConsent />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
