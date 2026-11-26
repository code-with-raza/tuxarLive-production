export const HAPPIERLEADS_URL = "https://rest.happierleads.com/v3/script?clientId=jZ92NLWAxokKRSTZVgqhan";
const SCRIPT_ID = "tuxar-happierleads";
const OPT_OUT = "tuxar_marketing_off";
let started = false;
let failed = false;
let marketingAllowed = false;
let retryScheduled = false;
let blocked = false;
export function globalPrivacyControl(): boolean {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
export function publicTrackingPath(path: string): boolean {
  return !/(?:^|\/)(?:admin|account|checkout|confirmation|cart|wishlist|login|register|forgot-password|reset-password|verify-email)(?:\/|$)/i.test(path);
}
export function marketingOptedOut(): boolean {
  return blocked || new URLSearchParams(window.location.search).get(OPT_OUT) === "1";
}
export function trackingBoundaryUrl(href: string): string {
  const target = new URL(href, window.location.origin);
  if (marketingOptedOut()) target.searchParams.set(OPT_OUT, "1");
  return target.href;
}
export function startHappierleads(marketing: boolean): void {
  marketingAllowed = marketing;
  if (!marketing || (started && !failed) || marketingOptedOut() || globalPrivacyControl() || !publicTrackingPath(window.location.pathname)) return;
  started = true; failed = false;
  const script = document.createElement("script");
  script.id = SCRIPT_ID; script.src = HAPPIERLEADS_URL; script.async = true; script.defer = true;
  script.fetchPriority = "low"; script.setAttribute("data-cfasync", "false");
  script.onerror = () => {
    if (document.getElementById(SCRIPT_ID) !== script) return;
    failed = true; script.remove();
    // Retry once automatically; the normal entry point rechecks consent, GPC and exclusions.
    if (!retryScheduled) { retryScheduled = true; setTimeout(() => startHappierleads(marketingAllowed), 1000); }
  };
  document.head.appendChild(script);
}
export function happierleadsStarted(): boolean { return started; }
export function clearHappierleadsStorage(): void {
  const keys = new Set(["hl_lead_id", "hl_full_mode_pages", "hl_last_tracking_time", "hl_basic_tracking_sent", "hl_last_sent_email", "changed_email_b", "activeTabId", "lastTimeSentToServer", "hl_rec_cfg"]);
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name], remove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && (keys.has(key) || key.startsWith("hl_pcap_"))) remove.push(key);
      }
      for (const key of remove) storage.removeItem(key);
    } catch { /* Storage may be disabled. */ }
  }
  for (const domain of ["", `; Domain=${window.location.hostname}`, "; Domain=.tuxar.co.uk"]) {
    document.cookie = `hl_ad=; Max-Age=0; Path=/; SameSite=Lax${domain}`;
  }
}
/** The vendor documents storage cleanup and reload, not a runtime stop API. */
export function stopHappierleads(preferenceSaved: boolean, destination?: string): void {
  blocked = true;
  document.getElementById(SCRIPT_ID)?.remove(); clearHappierleadsStorage();
  const target = new URL(destination || window.location.href, window.location.origin);
  if (!preferenceSaved) target.searchParams.set(OPT_OUT, "1");
  window.location.replace(target.href);
}
