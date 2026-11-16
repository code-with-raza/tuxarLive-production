import { getLocalizedSlug, resolveSlug, type Locale } from "./i18n";
import { setCurrency } from "@/lib/market";
const countries: Record<string,Locale> = {GB:"en",IT:"it",DE:"de",FR:"fr",ES:"es"};
export function localizedLanding(path: string, locale: Locale) {
  const parts = path.split("/").filter(Boolean);
  const previous = parts.shift() || "en";
  if (["product","collections","blog"].includes(parts[0]) && parts[1]) {
    const kind = parts[0] === "collections" ? "collection" : parts[0] === "blog" ? "blog" : "product";
    parts[1] = getLocalizedSlug(resolveSlug(parts[1],kind,previous as Locale),kind,locale);
  }
  return `/${locale}${parts.length ? "/"+parts.join("/") : ""}`;
}
let started = false;
export async function initializeAutomaticMarket() {
  if (started) return;
  // Private, payment and OAuth routes must never be moved by geolocation.
  const path = location.pathname;
  if (["code","access_token","token_hash","orderNumber","session_id"].some(key=>new URLSearchParams(location.search).has(key))) return;
  if (document.cookie.includes("tuxar-language-manual=") && document.cookie.includes("tuxar-currency-manual=")) return;
  if (!/^\/(en|de|es|fr|it)(\/|$)/.test(path) || /\/(admin|account|checkout|confirmation|login|register|verify-email|forgot-password|reset-password|cart|wishlist)(\/|$)/.test(path) || /bot|crawler|spider/i.test(navigator.userAgent)) return;
  started = true;
  try {
    if (sessionStorage.getItem("tuxar-market-checked")) return;
    sessionStorage.setItem("tuxar-market-checked","1");
    const response = await fetch("https://api.country.is/", {credentials:"omit",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(3500)});
    if (!response.ok) return;
    const data = await response.json();
    const locale = countries[data.country];
    if (!locale) return;
    document.cookie = `tuxar-country=${data.country}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (!document.cookie.includes("tuxar-currency-manual=")) setCurrency(data.country === "GB" ? "GBP" : "EUR", false);
    if (document.cookie.includes("tuxar-language-manual=")) return;
    document.cookie = `tuxar-locale=${locale}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const target = localizedLanding(path,locale);
    if (target !== path) location.replace(target+location.search+location.hash);
  } catch { /* Detection failure leaves browser language and manual selectors usable. */ }
}
