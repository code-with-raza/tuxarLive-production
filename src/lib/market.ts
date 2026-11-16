import { useSyncExternalStore } from "react";
export type Currency = "GBP" | "EUR";
const listeners = new Set<() => void>();
const valid = (value: unknown): value is Currency => value === "GBP" || value === "EUR";
function selected(): Currency | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie.match(/(?:^|;\s*)tuxar-currency=(GBP|EUR)(?:;|$)/)?.[1];
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
  return {currency, setCurrency, formatMoney: (amount: number) => new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, { style:"currency",currency,maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)};
}
