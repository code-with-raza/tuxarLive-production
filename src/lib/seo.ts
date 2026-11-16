import { SUPPORTED_LOCALES, type Locale } from "@/i18n/i18n";

export const SITE_URL = "https://tuxar.co.uk";

export function absoluteUrl(path: string) {
  return new URL(path, `${SITE_URL}/`).href;
}

export function localizedAlternates(pathForLocale: (locale: Locale) => string) {
  const links = SUPPORTED_LOCALES.map((locale) => ({
    rel: "alternate",
    hrefLang: locale,
    href: absoluteUrl(pathForLocale(locale)),
  }));

  return [
    ...links,
    {
      rel: "alternate",
      hrefLang: "x-default",
      href: absoluteUrl(pathForLocale("en")),
    },
  ];
}
