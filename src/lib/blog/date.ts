const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Publication days are calendar dates, not times in the visitor's timezone. */
export function blogDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  let date = value.trim();
  // Keep the publication calendar day; do not shift it into the visitor's timezone.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(date)) date = date.slice(0, 10);
  const legacy = /^([a-z]+)\s+(\d{1,2}),\s+(\d{4})$/i.exec(date);
  if (legacy) {
    const month = months.indexOf(legacy[1].toLowerCase()) + 1;
    if (!month) return undefined;
    date = `${legacy[3]}-${String(month).padStart(2, "0")}-${legacy[2].padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined;
}

export function formatBlogDate(value?: string, locale = "en"): string {
  const date = blogDateTime(value);
  if (!date) return "";
  const language = ({ en: "en-GB", de: "de-DE", fr: "fr-FR", it: "it-IT", es: "es-ES" } as Record<string, string>)[locale] ?? "en-GB";
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
