import { useSyncExternalStore } from "react";
import { publicSupabase } from "./supabase";
import { usdMinor, validUsdRate, type UsdQuote } from "../../supabase/functions/_shared/usd-money";
export type Currency = "GBP" | "EUR" | "USD";
const listeners = new Set<() => void>();
const valid = (value: unknown): value is Currency => value === "GBP" || value === "EUR" || value === "USD";
const usdListeners = new Set<() => void>();
const emptyUsd = { quote: null as UsdQuote | null, loading: false, error: null as string | null };
let usdState = emptyUsd;
let usdPending: Promise<void> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const USD_CACHE = "tuxar-usd-quote-v1";
function publishUsd(next: typeof emptyUsd) { usdState = next; usdListeners.forEach(listener => listener()); }
function acceptQuote(quote: UsdQuote) {
  if (!validUsdRate(quote) || typeof quote.token !== "string" || quote.token.length > 2048) throw new Error("Invalid USD quote");
  clearTimeout(expiryTimer);
  publishUsd({ quote, loading: false, error: null });
  expiryTimer = setTimeout(() => publishUsd({ quote, loading: false, error: "USD pricing expired. Refresh the rate and review your total." }), Math.max(1, quote.expiresAt - Date.now()));
  try { window.sessionStorage.setItem(USD_CACHE, JSON.stringify(quote)); } catch { /* In-memory pricing remains available. */ }
}
export function refreshUsdPricing(): Promise<void> {
  if (usdPending) return usdPending;
  publishUsd({ ...usdState, loading: true, error: null });
  usdPending = (async () => {
    try {
      const { data, error } = await publicSupabase.functions.invoke("usd-rate", { body: {} });
      if (error || !data) throw new Error("USD pricing is temporarily unavailable. Retry or choose GBP.");
      acceptQuote(data);
    } catch (error) {
      publishUsd({ quote: null, loading: false, error: error instanceof Error ? error.message : "USD pricing is unavailable" });
    } finally { usdPending = null; }
  })();
  return usdPending;
}
function initializeUsd() {
  if (usdState.quote || usdState.loading || usdState.error) return;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(USD_CACHE) || "null");
    if (validUsdRate(cached)) { acceptQuote(cached as UsdQuote); return; }
  } catch { /* Refresh missing, invalid or expired browser data. */ }
  void refreshUsdPricing();
}
function selected(): Currency | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie.match(/(?:^|;\s*)tuxar-currency=(GBP|EUR|USD)(?:;|$)/)?.[1];
  return valid(value) ? value : null;
}
export function setCurrency(value: Currency, manual = true) {
  if (!valid(value)) return;
  document.cookie = `tuxar-currency=${value}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (manual) document.cookie = `tuxar-currency-manual=1; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  listeners.forEach(listener => listener());
}
export function localeCurrency(locale: string): Currency { return ["de","es","fr","it"].includes(locale) ? "EUR" : "GBP"; }
export function countryDetectionNotice(locale: string) {
  return ({
    en:"We use Country.is to estimate your country from your IP address and suggest language and GBP/EUR pricing. No GPS location, account details or bag contents are sent. You can change language and currency yourself; your choices are remembered.",
    it:"Utilizziamo Country.is per stimare il paese dall’indirizzo IP e proporre lingua e prezzi in GBP/EUR. Non inviamo posizione GPS, dati dell’account o contenuto del carrello. Puoi modificare lingua e valuta; le tue scelte vengono ricordate.",
    de:"Country.is ermittelt anhand Ihrer IP-Adresse das ungefähre Land, um Sprache und GBP/EUR-Preise vorzuschlagen. GPS-Standort, Kontodaten und Warenkorbinhalte werden nicht gesendet. Sprache und Währung können Sie selbst wählen; Ihre Auswahl wird gespeichert.",
    fr:"Country.is estime votre pays à partir de votre adresse IP pour proposer une langue et des prix en GBP/EUR. Aucune position GPS, donnée de compte ou contenu du panier n’est transmis. Vous pouvez modifier la langue et la devise ; vos choix sont mémorisés.",
    es:"Country.is estima tu país a partir de tu dirección IP para sugerir idioma y precios en GBP/EUR. No se envían ubicación GPS, datos de cuenta ni contenido de la bolsa. Puedes cambiar el idioma y la moneda; tus elecciones se guardan.",
  } as Record<string,string>)[locale] || "";
}
export function useMarketCurrency(locale = "en") {
  const chosen = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, selected, () => null);
  const currency = chosen ?? localeCurrency(locale);
  const usd = useSyncExternalStore(listener => { usdListeners.add(listener); if (currency === "USD") initializeUsd(); return () => { usdListeners.delete(listener); }; }, () => usdState, () => emptyUsd);
  const currencyReady = currency !== "USD" || Boolean(usd.quote && !usd.loading && !usd.error && validUsdRate(usd.quote));
  const toMinor = (amount: number) => currency === "USD" ? (currencyReady && usd.quote ? usdMinor(Math.round(amount * 100), usd.quote.rateE8) : 0) : Math.round(amount * 100);
  const formatMinor = (minor: number) => !currencyReady ? "—" : new Intl.NumberFormat(locale === "en" ? (currency === "USD" ? "en-US" : "en-GB") : locale, {
    style: "currency", currency, minimumFractionDigits: currency === "USD" || minor % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(minor / 100);
  const cartMinor = (cart: { priceGBP: number; qty: number }[]) => cart.reduce((sum, item) => sum + toMinor(item.priceGBP) * item.qty, 0);
  return { currency, setCurrency, currencyReady, toMinor, formatMinor, cartMinor,
    formatMoney: (amount: number) => formatMinor(toMinor(amount)),
    formatSaving: (previous: number, current: number) => formatMinor(toMinor(previous) - toMinor(current)),
    formatLineMoney: (amount: number, qty: number) => formatMinor(toMinor(amount) * qty),
    formatCartTotal: (cart: { priceGBP: number; qty: number }[]) => formatMinor(cartMinor(cart)),
    usdQuote: currency === "USD" ? usd.quote : null,
    usdRateError: currency === "USD" ? usd.error : null,
    usdRateInfo: usd.quote ? `1 GBP = ${usd.quote.rateE8 / 100000000} USD · Reference rate ${usd.quote.date}` : "Loading USD pricing…",
    refreshUsdPricing,
  };
}
