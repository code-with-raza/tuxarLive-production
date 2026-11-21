import type { ReactNode } from "react";
import { REPLACEABLE_PAGES, type SitePage } from "@/lib/site-pages";
import { sanitizeRichHtml } from "@/lib/sanitize";

export function ManagedPageContent({ page, children }: { page: SitePage | null; children: ReactNode }) {
  if (!page) return children;
  const Heading = REPLACEABLE_PAGES.has(page.page_key) ? "h1" : "h2";
  return <>
    <section className="container-luxe py-12 md:py-20">
      {page.title && <Heading className="font-display text-4xl md:text-6xl mb-6">{page.title}</Heading>}
      {page.description && <p className="text-muted-foreground whitespace-pre-line mb-8">{page.description}</p>}
      <div className="journal-content rich-text-content max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.content_html) }} />
    </section>
    {!REPLACEABLE_PAGES.has(page.page_key) && children}
  </>;
}
