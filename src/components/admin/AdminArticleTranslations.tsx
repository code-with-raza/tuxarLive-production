import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BLOG_SLUG_MAP } from "@/i18n/i18n";
import { RichTextEditor } from "./RichTextEditor";
import { toast } from "sonner";

type Draft = { source_post_id: string; locale: string; source_updated_at: string; source_snapshot: Record<string, string>; title: string; slug: string; excerpt: string; content_markdown: string; seo_title: string; seo_description: string; review_required: boolean };
export function AdminArticleTranslations({ sourceId, sourceLocale }: { sourceId: string; sourceLocale: string }) {
  const [locale, setLocale] = useState("de");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (sourceLocale !== "en") return;
    let active = true;
    setDraft(null); setReviewed(false); setError(""); setDirty(false);
    void (async () => {
      const result = await supabase.from("blog_translation_drafts").select("*").eq("source_post_id", sourceId).eq("locale", locale).maybeSingle();
      if (!active) return;
      if (result.error) setError(`Cannot load translation drafts: ${result.error.message}`);
      else if (result.data) {
        const row = result.data as Draft;
        const mapping = Object.values(BLOG_SLUG_MAP).find(slugs => slugs.en === row.source_snapshot.slug);
        const slug = row.slug || mapping?.[locale as keyof typeof mapping] || row.source_snapshot.slug;
        let existing = {};
        if (!row.content_markdown) {
          const translation = await supabase.from("blog_posts").select("title,excerpt,content_markdown,seo_title,seo_description")
            .eq("locale", locale).eq("slug", slug).maybeSingle();
          if (!active) return;
          if (translation.error) { setError(`Cannot load the existing translation: ${translation.error.message}`); return; }
          existing = translation.data ?? {};
        }
        setDraft({ ...row, ...existing, slug });
      }
    })();
    return () => { active = false; };
  }, [sourceId, sourceLocale, locale, revision]);
  if (sourceLocale !== "en") return null;
  const save = async (publish: boolean) => {
    if (!draft || busy) return;
    setBusy(true); setError("");
    try {
      const result = await supabase.from("blog_translation_drafts").update({ title: draft.title, slug: draft.slug, excerpt: draft.excerpt, content_markdown: draft.content_markdown, seo_title: draft.seo_title, seo_description: draft.seo_description })
        .eq("source_post_id", sourceId).eq("locale", locale).eq("source_updated_at", draft.source_updated_at).select("source_post_id").single();
      if (result.error) throw new Error(`Draft save failed: ${result.error.message}. Reload if the English source changed.`);
      setDirty(false);
      if (publish) {
        const publication = await supabase.rpc("publish_reviewed_blog_translation", { p_source: sourceId, p_locale: locale, p_source_updated_at: draft.source_updated_at, p_reviewed: reviewed });
        if (publication.error) throw publication.error;
        toast.success("Reviewed translation published"); setReviewed(false);
      } else toast.success("Private translation draft saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Translation save failed. Please try again."); }
    finally { setBusy(false); }
  };
  const field = "border bg-background w-full p-3";
  const edit = (values: Partial<Draft>) => { if (draft) { setDraft({ ...draft, ...values }); setDirty(true); setReviewed(false); } };
  return <section className="bg-background border p-6 space-y-4">
    <h2 className="font-display text-3xl">Translation drafts for review</h2>
    <p className="text-sm">Save the English article first. Changes prepare a private review workspace for each language. No translation API is configured: enter translated text here. Existing published translations remain unchanged until you approve a replacement.</p>
    <label className="block">Language<select className={field} disabled={busy} value={locale} onChange={event => { if (!dirty || window.confirm("Discard unsaved translation edits?")) setLocale(event.target.value); }}>{["de","fr","it","es"].map(value => <option key={value}>{value}</option>)}</select></label>
    <button type="button" disabled={busy || dirty} className="underline" onClick={() => setRevision(revision + 1)}>Load latest English source and draft</button>
    {error && <p role="alert">{error}</p>}
    {!draft && !error && <p>Save the English article to prepare its translation drafts.</p>}
    {draft && <fieldset disabled={busy} className="space-y-4">
      <p>{draft.review_required ? "English changes need translation and review." : "This translation has been reviewed."}</p>
      <details><summary>English source</summary><h3>{draft.source_snapshot.title}</h3><pre className="whitespace-pre-wrap max-h-80 overflow-auto text-sm">{draft.source_snapshot.content_markdown}</pre></details>
      <label className="block">Translated title<input className={field} value={draft.title} onChange={event => edit({ title: event.target.value })}/></label>
      <label className="block">Translation URL handle<input className={field} value={draft.slug} onChange={event => edit({ slug: event.target.value })}/></label>
      <label className="block">Translated excerpt<textarea className={field} value={draft.excerpt} onChange={event => edit({ excerpt: event.target.value })}/></label>
      <RichTextEditor label="Translated article" value={draft.content_markdown} onChange={content_markdown => edit({ content_markdown })}/>
      <label className="block">Translated SEO title<input className={field} value={draft.seo_title} onChange={event => edit({ seo_title: event.target.value })}/></label>
      <label className="block">Translated meta description<textarea className={field} value={draft.seo_description} onChange={event => edit({ seo_description: event.target.value })}/></label>
      <button type="button" className="border px-4 py-3" onClick={() => void save(false)}>Save translation draft</button>
      <label className="flex gap-2"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>I reviewed this translation against the latest English source. Publishing updates this language’s URL.</label>
      <button type="button" disabled={!reviewed} className="border px-4 py-3 disabled:opacity-50" onClick={() => void save(true)}>Publish reviewed translation</button>
    </fieldset>}
  </section>;
}
