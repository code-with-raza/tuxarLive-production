import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { getStorefrontProducts } from "./lib/storefront-products";
import { getPublishedPosts } from "./lib/blog/published";
import { COLLECTIONS } from "./data/products";
import { CATEGORY_CHILDREN } from "./lib/catalogCategories";
import { resolveSlug, type Locale } from "./i18n/i18n";
import { collectionAudience, isProductForAudience } from "./lib/product-audience";
import { Route as rootRoute } from "./routes/__root";
import { Route as localeRouteImport } from "./routes/$locale";
import { Route as homeRouteImport } from "./routes/$locale.index";
import { Route as shop } from "./routes/$locale.shop";
import { Route as sales } from "./routes/$locale.sales";
import { Route as product } from "./routes/$locale.product.$slug";
import { Route as collection } from "./routes/$locale.collections.$slug";
import { Route as jackets } from "./routes/$locale.leather-jackets";
import { Route as women } from "./routes/$locale.women-leather-jackets";
import { Route as suits } from "./routes/$locale.motorcycle-suits";
import { Route as bags } from "./routes/$locale.leather-bags";
import { Route as accessories } from "./routes/$locale.accessories";
import { Route as about } from "./routes/$locale.about";
import { Route as blog } from "./routes/$locale.blog.index";
import { Route as article } from "./routes/$locale.blog.$slug";
import { Route as contact } from "./routes/$locale.contact";
import { Route as faq } from "./routes/$locale.faq";
import { Route as sizes } from "./routes/$locale.size-guide";
import { Route as shipping } from "./routes/$locale.shipping-policy";
import { Route as returns } from "./routes/$locale.returns-policy";
import { Route as privacy } from "./routes/$locale.privacy-policy";
import { Route as terms } from "./routes/$locale.terms-conditions";

// An explicit public-only route tree: never import account/admin/checkout modules.
const localeRoute = localeRouteImport.update({ id: "/$locale", path: "/$locale", getParentRoute: () => rootRoute } as never);
const homeRoute = homeRouteImport.update({ id: "/", path: "/", getParentRoute: () => localeRoute } as never);
const publicRoutes = [
  ["/shop", shop], ["/sales", sales], ["/product/$slug", product], ["/collections/$slug", collection],
  ["/leather-jackets", jackets], ["/women-leather-jackets", women], ["/motorcycle-suits", suits],
  ["/leather-bags", bags], ["/accessories", accessories], ["/about", about], ["/blog", blog],
  ["/blog/$slug", article], ["/contact", contact], ["/faq", faq], ["/size-guide", sizes],
  ["/shipping-policy", shipping], ["/returns-policy", returns], ["/privacy-policy", privacy],
  ["/terms-conditions", terms],
] as const;
const children = publicRoutes.map(([path, route]) => route.update({ id: path, path, getParentRoute: () => localeRoute } as never));
const routeTree = rootRoute.addChildren([localeRoute.addChildren([homeRoute, ...children])]);

export async function renderHomepage(locale: string) {
  return renderPublicPage(`/${locale}`);
}

/** The static release must not advertise products that are unpublished in Supabase. */
export async function publishedPublicUrls(urls: string[]) {
  const products = await getStorefrontProducts();
  const articleUrls = new Set<string>();
  if (urls.some(url => /\/(en|de|fr|it|es)\/blog\//.test(new URL(url).pathname))) {
    for (const locale of ['en','de','fr','it','es'] as const) {
      for (const post of await getPublishedPosts(locale)) articleUrls.add(`https://tuxar.co.uk/${locale}/blog/${post.slug}`);
    }
    // New CMS articles need initial HTML too; archived bundled URLs must not be rendered.
    urls = [...new Set([...urls, ...articleUrls])];
  }
  const active = new Set(products.map(product => product.slug));
  return urls.filter(url => {
    const [, locale, section, slug] = new URL(url).pathname.split("/");
    if (section === "blog" && slug) return articleUrls.has(url);
    if (section === "women-leather-jackets") return products.some(product => CATEGORY_CHILDREN["leather-jackets"].includes(product.category) && isProductForAudience(product, "women"));
    if (section === "product") return active.has(resolveSlug(slug, "product", locale as Locale));
    if (section !== "collections") return true;
    const id = resolveSlug(slug, "collection", locale as Locale);
    const collection = COLLECTIONS.find(item => item.slug === id);
    const audience = collectionAudience(id);
    return products.some(product => (product.collections?.includes(id) || product.collections?.includes(collection?.sourceCollection ?? id)) && (!audience || isProductForAudience(product, audience)));
  });
}

export async function renderPublicPage(path: string) {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  if (router.state.matches.some(match => match.status === "error" || match.status === "notFound")) throw new Error(`Public rendering failed: ${path}`);
  return renderToString(<RouterProvider router={router} />);
}
