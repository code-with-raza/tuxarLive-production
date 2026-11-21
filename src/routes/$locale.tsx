import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { SUPPORTED_LOCALES, Locale, DEFAULT_LOCALE } from "@/i18n/i18n";
import { useEffect } from "react";
import { initializeAutomaticMarket } from "@/i18n/automatic-market";
import { getSitePage } from "@/lib/site-pages";
import { ManagedPageContent } from "@/components/site/ManagedPageContent";

export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    const isSupported = SUPPORTED_LOCALES.includes(params.locale as Locale);
    if (!isSupported) {
      throw redirect({
        to: `/${DEFAULT_LOCALE}` as any,
      });
    }
  },
  staleTime: 0,
  loader: async ({ params, location }) => {
    return { locale: params.locale as Locale, page: await getSitePage(location.pathname, params.locale) };
  },
  component: LocaleLayout,
  notFoundComponent: LocaleNotFound,
});

function LocaleNotFound() {
  useEffect(() => {
    document.title = "Page not found — Tuxar";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-4">404</p>
        <h1 className="font-display text-5xl md:text-6xl">Page not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you're looking for has moved or no longer exists.
        </p>
        <Link
          to="/$locale"
          params={{ locale: "en" }}
          className="mt-8 inline-flex h-11 items-center justify-center bg-foreground px-6 text-sm tracking-widest uppercase text-background"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function LocaleLayout() {
  const { locale, page } = Route.useLoaderData();
  const pathname = useLocation({select: location => location.pathname});

  useEffect(() => {
    document.documentElement.lang = locale;
    void initializeAutomaticMarket();
  }, [locale, pathname]);

  return <ManagedPageContent page={page}><Outlet /></ManagedPageContent>;
}
