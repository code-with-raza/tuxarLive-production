import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { analyticsConfigured, disableAnalytics, loadAnalytics, trackPageView } from "@/lib/analytics";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/i18n";
import { CONSENT_KEY, essentialOnly, readCookiePreferences, saveCookiePreferences, type CookiePreferences } from "@/lib/cookie-preferences";
import { globalPrivacyControl, marketingOptedOut, publicTrackingPath, startHappierleads, happierleadsStarted, stopHappierleads, trackingBoundaryUrl } from "@/lib/happierleads";
import { startRB2B, rb2bStarted, clearRB2B } from "@/lib/rb2b";
const OPEN_EVENT = "tuxar:open-cookie-settings";
const identificationStarted = () => happierleadsStarted() || rb2bStarted();
const stopIdentification = (saved: boolean, destination?: string) => { clearRB2B(); stopHappierleads(saved, destination); };
export function openCookieSettings() { window.dispatchEvent(new Event(OPEN_EVENT)); }
export function CookieConsent() {
  const router = useRouter();
  const location = useRouterState({ select: state => state.location });
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  const [draft, setDraft] = useState(essentialOnly);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [gpc, setGpc] = useState(false);
  const first = location.pathname.split("/")[1] as Locale;
  const locale = SUPPORTED_LOCALES.includes(first) ? first : DEFAULT_LOCALE;
  useEffect(() => {
    // A full document boundary prevents the public pixel observing private SPA URLs.
    const unblock = router.history.block({ enableBeforeUnload: false, blockerFn: ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string; href: string } }) => {
      if (publicTrackingPath(currentLocation.pathname) !== publicTrackingPath(nextLocation.pathname)) {
        const target = trackingBoundaryUrl(nextLocation.href);
        if (identificationStarted()) stopIdentification(true, target);
        else window.location.assign(target);
        return true;
      }
      return false;
    }});
    const refresh = (resetDraft = false) => {
      const saved = readCookiePreferences(), privacy = globalPrivacyControl();
      const effective = { ...(saved || essentialOnly()), marketing: Boolean(saved?.marketing && !privacy && !marketingOptedOut()) };
      if (!effective.analytics) disableAnalytics();
      setGpc(privacy);
      setPreferences(previous => previous?.analytics === effective.analytics && previous.marketing === effective.marketing ? previous : effective);
      if (resetDraft) setDraft(effective);
      else if (privacy) setDraft(previous => ({ ...previous, marketing: false }));
      if (!effective.marketing && identificationStarted()) stopIdentification(saveCookiePreferences(effective));
      return saved;
    };
    setOpen(!refresh(true));
    const handleOpen = () => { refresh(true); setManaging(true); setOpen(true); };
    const changed = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) refresh(true); };
    const focused = () => { refresh(); };
    window.addEventListener(OPEN_EVENT, handleOpen); window.addEventListener("storage", changed);
    window.addEventListener("focus", focused); window.addEventListener("pageshow", focused);
    return () => { unblock(); window.removeEventListener(OPEN_EVENT, handleOpen); window.removeEventListener("storage", changed); window.removeEventListener("focus", focused); window.removeEventListener("pageshow", focused); };
  }, [router]);
  const analyticsConsent = preferences?.analytics;
  const marketingConsent = preferences?.marketing;
  useEffect(() => {
    if (analyticsConsent) {
      loadAnalytics();
      if (analyticsConfigured()) trackPageView(`${location.pathname}${location.searchStr || ""}`, document.title);
    } else if (analyticsConsent === false) disableAnalytics();
  }, [analyticsConsent, location.pathname, location.searchStr]);
  useEffect(() => { startHappierleads(Boolean(marketingConsent)); startRB2B(Boolean(marketingConsent)); }, [marketingConsent, location.pathname]);
  const save = (next: CookiePreferences) => {
    const effective = { ...next, marketing: next.marketing && !globalPrivacyControl() && !marketingOptedOut() };
    const persisted = saveCookiePreferences(effective);
    if (!effective.analytics) disableAnalytics();
    setPreferences(effective); setDraft(effective); setOpen(false);
    if (!effective.marketing && identificationStarted()) stopIdentification(persisted);
  };
  if (!open) return null;
  return <section role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl max-h-[85vh] overflow-y-auto border border-border bg-background p-5 shadow-2xl sm:inset-x-6 sm:p-6">
    <h2 id="cookie-consent-title" className="font-display text-xl">Your privacy choices</h2>
    <p className="mt-2 text-sm text-muted-foreground">Essential storage supports your bag, language, account and privacy choices. With your permission, we use Google Analytics to understand shop usage and Happierleads and RB2B to identify visitors and companies using visit and browser information, including IP addresses and email addresses you provide. Visit data is shared with Happierleads and RB2B. Optional purposes stay off until you accept them; you can change or withdraw consent in Cookie settings.</p>
    {managing && <div id="cookie-preferences">
    <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={draft.analytics} onChange={event => setDraft({ ...draft, analytics: event.target.checked })} className="mt-1 h-4 w-4 shrink-0"/><span><strong>Analytics</strong><span className="block text-muted-foreground">Google Analytics helps us understand how the shop is used.</span></span></label>
    <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={draft.marketing && !gpc} disabled={gpc} onChange={event => setDraft({ ...draft, marketing: event.target.checked })} className="mt-1 h-4 w-4 shrink-0"/><span><strong>Marketing — visitor identification</strong><span className="block text-muted-foreground">Happierleads and RB2B identify visitors and companies using visit and browser information, including IP addresses and email addresses you provide. Visit data is shared with Happierleads and RB2B. Analytics permission alone does not enable this.</span></span></label>
    </div>}
    {gpc && <p role="status" className="mt-3 text-sm">Global Privacy Control is enabled. Marketing identification is blocked.</p>}
    <Link to="/$locale/privacy-policy" params={{ locale }} className="mt-3 inline-block text-xs underline">Read our privacy policy</Link>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => save({ ...essentialOnly(), analytics: true, marketing: true })} className="min-h-11 border border-foreground px-5 text-xs uppercase tracking-widest">Accept all</button>
      <button type="button" onClick={() => save(essentialOnly())} className="min-h-11 border border-foreground px-5 text-xs uppercase tracking-widest">Reject optional</button>
      {managing
        ? <button type="button" onClick={() => save(draft)} className="min-h-11 border border-foreground px-5 text-xs uppercase tracking-widest">Save preferences</button>
        : <button type="button" onClick={() => setManaging(true)} aria-expanded={false} aria-controls="cookie-preferences" className="min-h-11 border border-foreground px-5 text-xs uppercase tracking-widest">Manage preferences</button>}
    </div>
  </section>;
}
