export type AnalyticsEventParams = Record<string, string | number | boolean | object[] | undefined>;

export type PurchaseAnalytics = {
  transaction_id: string;
  value: number;
  currency: string;
  shipping?: number;
  coupon?: string;
  discount?: number;
  items: Array<{
    item_id: string;
    item_name: string;
    item_variant?: string;
    price: number;
    quantity: number;
  }>;
};

const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
let loading = false;
let analyticsAllowed = false;
let configured = false;
let lastPageLocation: string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __tuxarAnalyticsLoaded?: boolean;
  }
}

export function analyticsConfigured() {
  return Boolean(measurementId && /^G-[A-Z0-9]+$/i.test(measurementId));
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  // gtag's public queue protocol uses an Arguments object, as in Google's snippet.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = window.gtag || function () { window.dataLayer?.push(arguments); };
}

export function loadAnalytics() {
  if (!analyticsConfigured()) return;
  analyticsAllowed = true;
  ensureGtag();
  const gtag = window.gtag!;
  if (measurementId) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = false;
  }
  gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (loading || window.__tuxarAnalyticsLoaded) return;
  loading = true;

  if (!configured) {
    gtag("js", new Date());
    gtag("config", measurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });
    configured = true;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId!)}`;
  script.onload = () => {
    window.__tuxarAnalyticsLoaded = true;
    loading = false;
  };
  script.onerror = () => {
    loading = false;
    script.remove();
  };
  document.head.appendChild(script);
}

export function trackPageView(path: string, title: string) {
  if (!analyticsAllowed || !window.gtag || !measurementId) return;
  const pageLocation = new URL(path, window.location.origin).href;
  // Effects may run twice or preferences may be saved again on the same route.
  // Only suppress consecutive duplicates, so returning to a page is still counted.
  if (lastPageLocation === pageLocation) return;
  const referrer = lastPageLocation ?? document.referrer;
  lastPageLocation = pageLocation;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: pageLocation,
    page_referrer: referrer,
    page_title: title,
    send_to: measurementId,
  });
}

export function trackEvent(name: string, params: AnalyticsEventParams = {}) {
  if (!analyticsAllowed || !window.gtag) return;
  window.gtag("event", name, params);
}

export function trackPurchaseOnce(purchase: PurchaseAnalytics | undefined) {
  if (!purchase?.transaction_id || !analyticsAllowed || !window.gtag) return;
  const key = `tuxar-ga4-purchase:${purchase.transaction_id}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "sent");
  } catch {
    // If storage is unavailable, GA4's transaction_id still helps identify duplicates.
  }
  window.gtag("event", "purchase", purchase);
}

export function disableAnalytics() {
  analyticsAllowed = false;
  if (!measurementId) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.tuxar.co.uk; SameSite=Lax`;
  }
}
