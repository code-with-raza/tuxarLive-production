import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LOCALE } from "@/i18n/i18n";
import { browserLocale, preferredLocale } from "@/i18n/preferred-locale";

export const Route = createFileRoute("/")({
  beforeLoad: ({ request }: any) => {
    let locale = DEFAULT_LOCALE;

    // Detect from client side first
    if (typeof window !== "undefined") {
      locale = browserLocale();
    } else if (request) {
      // Detect from server side cookie
      locale = preferredLocale(request.headers.get("cookie") || "", null,
        (request.headers.get("accept-language") || "").split(",")[0].split(";")[0]);
    }

    throw redirect({
      to: `/${locale}` as any,
    });
  },
});
