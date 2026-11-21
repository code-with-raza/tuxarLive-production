import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { AdminArticleTranslations } from "./AdminArticleTranslations";
import { articleDraftKey, blankArticle, readArticleDraft, writeArticleDraft, type ArticleDraft } from "@/lib/article-draft";

export function AdminArticleEditor({ id, locale }: { id: string; locale: string }) {
  const navigate = useNavigate();
  const [post, setPostState] = useState<ArticleDraft | null>(null);
  const current = useRef<ArticleDraft | null>(null);
  const owner = useRef("");
  const persisted = useRef(false);
  const dirty = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const setPost = (next: ArticleDraft) => {
    current.current = next;
    dirty.current = true;
    setPostState(next);
    const key = articleDraftKey(owner.current, locale, id);
    const saved = writeArticleDraft(sessionStorage, key, next, persisted.current);
    setMessage(saved ? "Unsaved changes · recovered automatically in this tab" : "Unsaved changes · browser recovery unavailable; save before leaving");
  };
  const [saving, setSaving] = useState(false);
  const field = "h-11 w-full border bg-background px-3 text-sm";
  useEffect(() => {
    let active = true;
    setError("");
    current.current = null;
    setPostState(null);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Token renewal and returning to a tab must not reload the editor's form.
      if (owner.current && session?.user.id !== owner.current) {
        active = false;
        current.current = null;
        setPostState(null);
        setError("Your sign-in changed. Sign in again to continue editing.");
      }
    });
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error("Please sign in again to edit this article.");
        if (!active) return;
        owner.current = auth.data.user.id;
        const key = articleDraftKey(owner.current, locale, id);
        const recovered = readArticleDraft(sessionStorage, key);
        let next: ArticleDraft;
        let isPersisted = false;
        let isDirty = false;
        if (recovered && (id === "new" || recovered.post.id === id)) {
          next = recovered.post;
          isPersisted = recovered.persisted;
          isDirty = true;
          setMessage("Recovered your unsaved article in this tab");
        } else if (id === "new") {
          next = blankArticle(locale, crypto.randomUUID());
        } else {
          const result = await supabase.from("blog_posts").select("*").eq("id", id).single();
          if (result.error) throw result.error;
          next = { ...blankArticle(locale, id), ...result.data };
          for (const field of ["excerpt", "seo_title", "seo_description", "cover_image_url", "cover_image_alt"] as const) next[field] ??= "";
          isPersisted = true;
        }
        if (!active) return;
        persisted.current = isPersisted;
        dirty.current = isDirty;
        current.current = next;
        setPostState(next);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the article. Please try again.");
      }
    })();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("beforeunload", beforeUnload); };
  }, [id, locale]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!post || saving) return;
    if (!post.title.trim() || !post.slug.trim() || !post.content_markdown.trim()) { toast.error("Add a title, URL slug and article content before saving."); return; }
    setSaving(true);
    const snapshot = current.current!;
    // Send only editable columns; never write fetched ownership or timestamp fields.
    const values = Object.fromEntries(Object.keys(blankArticle(locale, snapshot.id)).map(key => [key, snapshot[key as keyof ArticleDraft]]));
    try {
      const request = persisted.current
        ? supabase.from("blog_posts").update({ ...values, updated_at: new Date().toISOString() }).eq("id", snapshot.id)
        : supabase.from("blog_posts").insert(values);
      const result = await request.select("id").single();
      if (result.error) throw result.error;
      // Do not navigate or restore private content after a sign-out during Save.
      if (!current.current || current.current.id !== snapshot.id) return;
      persisted.current = true;
      const latest = current.current;
      dirty.current = latest !== snapshot;
      const key = articleDraftKey(owner.current, locale, id);
      if (dirty.current) writeArticleDraft(sessionStorage, key, latest, true);
      else sessionStorage.removeItem(key);
      setMessage(dirty.current ? "Article saved · newer edits are still unsaved" : "All changes saved");
      toast.success("Article saved");
      if (id === "new") {
        if (dirty.current && !writeArticleDraft(sessionStorage, articleDraftKey(owner.current, locale, snapshot.id), latest, true)) return;
        sessionStorage.removeItem(key);
        await navigate({ to: "/$locale/admin/journal/$id", params: { locale, id: snapshot.id }, replace: true });
      }
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Article save failed. Your edits are still here."); }
    finally { setSaving(false); }
  };
  if (error) return <main className="container-luxe py-16"><p role="alert">{error}</p><a href={`/${locale}/admin?section=journal`} className="underline">Return to Journal</a></main>;
  if (!post)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  return (
    <main className="bg-section min-h-screen py-10">
      <div className="container-luxe max-w-6xl">
        <a
          href={`/${locale}/admin?section=journal`}
          className="inline-flex gap-2 text-xs uppercase tracking-widest mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Journal
        </a>
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="eyebrow">Journal editor</p>
            <h1 className="font-display text-4xl">{post.title || "New article"}</h1>
            <p className="text-sm text-muted-foreground mt-2" role="status">{message || "Save your article when ready. Switching tabs keeps this editor open."}</p>
          </div>
          <button
            form="article-form"
            disabled={saving}
            className="h-11 bg-foreground text-background px-6 inline-flex gap-2 items-center text-xs uppercase tracking-widest"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">Publishing and archiving update fresh website views. New article content, search previews and the sitemap need the <a className="underline" href="https://github.com/code-with-raza/tuxarLive-production/actions/workflows/deploy.yml" target="_blank" rel="noreferrer">website publishing workflow</a> to refresh their initial HTML.</p>
        <form id="article-form" onSubmit={save} className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Article</h2>
              <label className="block text-xs uppercase tracking-widest">
                Article title
                <input
                  className={`${field} mt-2`}
                  required
                  value={post.title}
                  onChange={(e) => setPost({ ...post, title: e.target.value })}
                />
              </label>
              <label className="block text-xs uppercase tracking-widest">
                Short excerpt
                <textarea
                  className="mt-2 w-full min-h-24 border p-3 normal-case tracking-normal"
                  value={post.excerpt}
                  onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
                />
              </label>
              <RichTextEditor
                label="Article content"
                value={post.content_markdown}
                onChange={(content_markdown) => setPost({ ...post, content_markdown })}
                minHeight="520px"
              />
            </section>
            <section className="bg-background border p-6">
              <div className="mb-4">
                <h2 className="font-display text-2xl">Featured image</h2>
              </div>
              <AdminMediaManager
                entityType="blog"
                entityId={post.id}
                contextName={post.title}
                scope="website"
                defaultRole="cover"
                compact
                onSelect={(asset) => { if (current.current) setPost({ ...current.current, cover_image_url: asset.secure_url, cover_image_alt: asset.alt_text, cover_media_id: asset.id }); }}
                onUploaded={(asset) => {
                  if (!current.current) return;
                  const next = {
                    ...current.current,
                    cover_image_url: asset.secure_url,
                    cover_image_alt: asset.alt_text,
                    cover_media_id: asset.id,
                  };
                  setPost(next);
                }}
              />
              <label className="block text-sm mt-4">Featured image URL
                <input type="url" pattern="https://.*" placeholder="https://…" className={`${field} mt-2`} value={post.cover_image_url} onChange={event => setPost({ ...post, cover_image_url: event.target.value, cover_media_id: null })} />
              </label>
              <label className="block text-sm mt-4">Image alternative text
                <input className={`${field} mt-2`} value={post.cover_image_alt} onChange={event => setPost({ ...post, cover_image_alt: event.target.value })} />
              </label>
              {post.cover_image_url ? (
                <img
                  src={post.cover_image_url}
                  alt={post.cover_image_alt}
                  className="w-full max-h-96 object-contain bg-section"
                />
              ) : (
                <p className="text-muted-foreground">No image uploaded.</p>
              )}
            </section>
          </div>
          <aside className="space-y-6">
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Publishing</h2>
              <select
                aria-label="Publication status"
                className={field}
                value={post.status}
                onChange={(e) =>
                  setPost({
                    ...post,
                    status: e.target.value as ArticleDraft["status"],
                    published_at:
                      e.target.value === "published"
                        ? post.published_at || new Date().toISOString()
                        : post.published_at,
                  })
                }
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                aria-label="Article language"
                className={field}
                value={post.locale}
                onChange={(e) => setPost({ ...post, locale: e.target.value })}
              >
                {["en", "de", "fr", "it", "es"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Published articles appear in the selected language only. Add a separate translated article for each other language.</p>
            </section>
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Organization</h2>
              <label className="block text-sm">URL slug<input
                className={field}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="my-article-title"
                value={post.slug}
                onChange={(e) => setPost({ ...post, slug: e.target.value })}
              /></label>
              <label className="block text-sm">Category<input
                className={field}
                value={post.category}
                onChange={(e) => setPost({ ...post, category: e.target.value })}
              /></label>
              <label className="block text-sm">Author<input
                className={field}
                value={post.author}
                onChange={(e) => setPost({ ...post, author: e.target.value })}
              /></label>
            </section>
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Search engine listing</h2>
              <label className="block text-sm">SEO title<input
                className={field}
                value={post.seo_title}
                onChange={(e) => setPost({ ...post, seo_title: e.target.value })}
              /></label>
              <label className="block text-sm">SEO description<textarea
                className="w-full min-h-28 border p-3"
                value={post.seo_description}
                onChange={(e) => setPost({ ...post, seo_description: e.target.value })}
              /></label>
              <p className="text-xs text-muted-foreground">{post.seo_description.length} characters</p>
            </section>
          </aside>
        </form>
        {persisted.current && <AdminArticleTranslations key={post.id} sourceId={post.id} sourceLocale={post.locale} />}
      </div>
    </main>
  );
}
