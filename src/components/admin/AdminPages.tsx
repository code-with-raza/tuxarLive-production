import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { SITE_PAGES, REPLACEABLE_PAGES, type SitePage, type SitePageKey } from "@/lib/site-pages";
import { RichTextEditor } from "./RichTextEditor";
import { sanitizeRichHtml } from "@/lib/sanitize";

export function AdminPages() {
  const [key, setKey] = useState<SitePageKey>("about");
  const [locale, setLocale] = useState("en");
  const [page, setPage] = useState<SitePage | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null); setError(""); setDirty(false);
    void (async () => {
      const result = await supabase.from("site_pages").select("*").eq("page_key", key).eq("locale", locale).maybeSingle();
      if (!active) return;
      if (result.error) { setError(`Cannot load page: ${result.error.message}. Check your sign-in and that the page-content migration is installed.`); return; }
      setPage(result.data ?? { page_key: key, locale, title: "", description: "", content_html: "", status: "draft" });
    })();
    return () => { active = false; };
  }, [key, locale, reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const edit = (values: Partial<SitePage>) => { if (page) { setPage({ ...page, ...values }); setDirty(true); } };
  const save = async () => {
    if (!page || saving) return;
    if (page.status === "published" && (!page.title.trim() || !page.content_html.trim())) { toast.error("Add a title and page content before publishing."); return; }
    setSaving(true); setError("");
    try {
      const values = { ...page, content_html: sanitizeRichHtml(page.content_html), updated_at: new Date().toISOString() };
      // Confirm the saved record; RLS denials must never produce a success toast.
      const request = page.updated_at
        ? supabase.from("site_pages").update(values).eq("locale", page.locale).eq("page_key", page.page_key).eq("updated_at", page.updated_at)
        : supabase.from("site_pages").insert(values);
      const result = await request.select("*").single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No saved record was returned. Check your page-editing permissions.");
      setPage(result.data); setDirty(false);
      toast.success("Page saved. Published content is read on the next navigation; rebuild to refresh initial HTML.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed. Your edits remain here; check permissions and try again."); }
    finally { setSaving(false); }
  };
  const field = "border bg-background p-3 w-full";
  return <div className="space-y-6">
    <h2 className="font-display text-4xl">Website pages</h2>
    <p className="text-sm text-muted-foreground">Edit each language independently. Products, collections, Journal articles and banners retain their dedicated editors. Checkout and account controls remain functional.</p>
    <div className="grid sm:grid-cols-2 gap-4">
      <label>Page<select disabled={saving} className={field} value={key} onChange={event => { if (!dirty || window.confirm("Discard unsaved page edits?")) setKey(event.target.value as SitePageKey); }}>{Object.entries(SITE_PAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Language<select disabled={saving} className={field} value={locale} onChange={event => { if (!dirty || window.confirm("Discard unsaved page edits?")) setLocale(event.target.value); }}>{["en", "de", "fr", "it", "es"].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <p>{REPLACEABLE_PAGES.has(key) ? "Published content replaces this editorial page’s body. A draft keeps the existing website version." : "Published content adds an introduction above this page. Its shopping, navigation and form controls are preserved."}</p>
    {error && <div role="alert"><p>{error}</p><button disabled={dirty} onClick={() => setReload(reload + 1)} className="underline">Retry loading</button></div>}
    {page && <fieldset disabled={saving} className="space-y-4">
      <label className="block">Title<input className={field} value={page.title} onChange={event => edit({ title: event.target.value })} /></label>
      <label className="block">Description<textarea className={field} value={page.description} onChange={event => edit({ description: event.target.value })} /></label>
      <RichTextEditor value={page.content_html} onChange={content_html => edit({ content_html })} label="Page content" />
      <label className="block">Publication<select className={field} value={page.status} onChange={event => edit({ status: event.target.value as SitePage["status"] })}><option value="draft">Draft — use existing website content</option><option value="published">Published</option></select></label>
      <button type="button" onClick={() => void save()} className="bg-foreground text-background px-6 py-3">{saving ? "Saving…" : "Save page"}</button>
      <p className="text-sm">Initial HTML and search-engine previews update through <a className="underline" href="https://github.com/code-with-raza/tuxarLive-production/actions/workflows/deploy.yml" target="_blank" rel="noreferrer">Publish website</a>. Saving alone does not run this workflow.</p>
    </fieldset>}
  </div>;
}
