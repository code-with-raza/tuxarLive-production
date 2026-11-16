import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  analyticsConfigured,
  disableAnalytics,
  loadAnalytics,
  trackPageView,
} from "@/lib/analytics";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/i18n";

type ConsentChoice = "accepted" | "rejected";

const STORAGE_KEY = "tuxar-cookie-consent";
const OPEN_EVENT = "tuxar:open-cookie-settings";

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CookieConsent() {
  const location = useRouterState({ select: (state) => state.location });
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [open, setOpen] = useState(false);
  const firstPathSegment = location.pathname.split("/")[1] as Locale;
  const locale = SUPPORTED_LOCALES.includes(firstPathSegment) ? firstPathSegment : DEFAULT_LOCALE;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ConsentChoice | null;
    setChoice(saved);
    setOpen(saved !== "accepted" && saved !== "rejected");
    if (saved === "accepted") loadAnalytics();

    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (choice !== "accepted" || !analyticsConfigured()) return;
    loadAnalytics();
    trackPageView(`${location.pathname}${location.searchStr || ""}`, document.title);
  }, [choice, location.pathname, location.searchStr]);

  const saveChoice = (nextChoice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, nextChoice);
    setChoice(nextChoice);
    setOpen(false);
    if (nextChoice === "accepted") loadAnalytics();
    else disableAnalytics();
  };

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl border border-border bg-background p-5 shadow-2xl sm:inset-x-6 sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 id="cookie-consent-title" className="font-display text-xl">
            Your privacy choices
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We use essential storage for the bag, language and account features. With your
            permission, Google Analytics will help us understand how the shop is used. Analytics
            stays off unless you accept.
          </p>
          <Link
            to="/$locale/privacy-policy"
            params={{ locale }}
            className="mt-2 inline-block text-xs underline underline-offset-2"
          >
            Read our privacy policy
          </Link>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-40">
          <button
            type="button"
            onClick={() => saveChoice("accepted")}
            className="h-11 bg-foreground px-5 text-xs uppercase tracking-widest text-background"
          >
            Accept analytics
          </button>
          <button
            type="button"
            onClick={() => saveChoice("rejected")}
            className="h-11 border border-foreground px-5 text-xs uppercase tracking-widest"
          >
            Essential only
          </button>
        </div>
      </div>
    </section>
  );
}
