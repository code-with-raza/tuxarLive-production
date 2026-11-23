export const CONSENT_KEY = "tuxar-cookie-consent";
export type CookiePreferences = { version: 2; analytics: boolean; marketing: boolean };
export const essentialOnly = (): CookiePreferences => ({ version: 2, analytics: false, marketing: false });
export function parseCookiePreferences(value: string | null): CookiePreferences | null {
  if (value === "accepted") return { ...essentialOnly(), analytics: true };
  if (value === "rejected") return essentialOnly();
  try {
    const saved = JSON.parse(value || "null");
    return saved?.version === 2 && typeof saved.analytics === "boolean" && typeof saved.marketing === "boolean" ? saved : null;
  } catch { return null; }
}
export function readCookiePreferences(): CookiePreferences | null {
  try { return parseCookiePreferences(window.localStorage.getItem(CONSENT_KEY)); } catch { return null; }
}
export function saveCookiePreferences(value: CookiePreferences): boolean {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
    return window.localStorage.getItem(CONSENT_KEY) === JSON.stringify(value);
  } catch { return false; }
}
