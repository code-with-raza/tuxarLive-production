import type { Locale } from "./i18n";

const supported = new Set<Locale>(["en", "it", "de", "fr", "es"]);

export function preferredLocale(cookie: string, stored: string | null, language: string): Locale {
  const savedCookie = cookie.match(/(?:^|;\s*)tuxar-locale=(en|it|de|fr|es)(?:;|$)/)?.[1];
  if (savedCookie) return savedCookie as Locale;
  if (stored && supported.has(stored as Locale)) return stored as Locale;
  const primary = language.trim().toLowerCase().split("-")[0] as Locale;
  return supported.has(primary) ? primary : "en";
}

export function browserLocale(): Locale {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem("tuxar-locale");
  } catch {
    // A blocked storage API must not prevent language selection or navigation.
  }
  return preferredLocale(document.cookie, stored, navigator.language);
}

export function saveLocale(locale: Locale) {
  document.cookie = `tuxar-language-manual=1; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try {
    window.localStorage.setItem("tuxar-locale", locale);
  } catch {
    // The cookie still remembers a choice when localStorage is unavailable.
  }
  document.cookie = `tuxar-locale=${locale}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
