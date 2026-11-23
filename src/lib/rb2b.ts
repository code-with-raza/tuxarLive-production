import { globalPrivacyControl, marketingOptedOut, publicTrackingPath } from "./happierleads";

export const RB2B_URL = "https://ddwl4m2hdecbv.cloudfront.net/b/4N210HX0KG6Z/4N210HX0KG6Z.js.gz";
const SCRIPT_ID = "tuxar-rb2b";
let started = false;
type RB2BWindow = Window & { reb2b?: { loaded: boolean } };

export function startRB2B(marketing: boolean): void {
  if (!marketing || started || marketingOptedOut() || globalPrivacyControl() || !publicTrackingPath(window.location.pathname)) return;
  const vendorWindow = window as RB2BWindow;
  if (vendorWindow.reb2b) return;
  started = true;
  vendorWindow.reb2b = { loaded: true };
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = RB2B_URL;
  script.fetchPriority = "low";
  document.head.appendChild(script);
}

export function rb2bStarted(): boolean { return started; }

/** Reload after cleanup to stop any listeners installed by the vendor. */
export function clearRB2B(): void {
  document.getElementById(SCRIPT_ID)?.remove();
  const names = new Set(["_reb2bgeo", "_reb2bloaded", "_reb2bref", "_reb2sessionID", "_reb2buid", "_reb2bfxf", "_reb2btd", "_reb2bli", "_reb2bresolve", "_reb2butk"]);
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      const remove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && (names.has(key) || key.startsWith("_reb2b"))) remove.push(key);
      }
      for (const key of remove) storage.removeItem(key);
    } catch { /* Storage may be disabled. */ }
  }
  for (const name of names) {
    for (const domain of ["", `; Domain=${window.location.hostname}`, "; Domain=.tuxar.co.uk"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain}`;
    }
  }
}
