import { useCallback, useEffect, useState } from "react";
import { Archive, FilePlus2, Pencil, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  locale: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
};
export function AdminJournal() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const query = supabase
      .from("blog_posts")
      .select("id,locale,slug,title,status,published_at")
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else {
      const [{ getAllPosts }, { filterPostsByLocale }] = await Promise.all([import("@/lib/blog"), import("@/lib/blog/locale")]);
      const states = await supabase.from("blog_publication_states").select("locale,slug,is_published");
      if (states.error) { toast.error(`Cannot check legacy article visibility: ${states.error.message}`); return; }
      const stored = (data ?? []) as Post[];
      const keys = new Set(stored.map(post => `${post.locale}:${post.slug}`));
      const visibility = new Map((states.data ?? []).map(row => [`${row.locale}:${row.slug}`, row.is_published]));
      const bundled = (["en", "de", "fr", "it", "es"] as const).flatMap(locale => filterPostsByLocale(getAllPosts(), locale)
        .filter(post => !keys.has(`${locale}:${post.slug}`))
        .map(post => ({ id: `bundled--${post.slug}`, locale, slug: post.slug, title: post.title,
          status: visibility.get(`${locale}:${post.slug}`) === false ? "archived" : "published", published_at: post.date || null })));
      setPosts([...stored, ...bundled]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const ensureStored = async (post: Post, status = post.status): Promise<string> => {
    if (!post.id.startsWith("bundled--")) return post.id;
    const { getAllPosts } = await import("@/lib/blog");
    const source = getAllPosts().find(item => item.slug === post.slug);
    if (!source) throw new Error("The built-in article could not be found. Reload the Journal.");
    const date = source.date ? new Date(source.date) : new Date();
    const result = await supabase.from("blog_posts").insert({
      locale: post.locale, slug: source.slug, title: source.title, excerpt: source.excerpt,
      content_markdown: source.contentMarkdown, category: source.category, author: source.author,
      cover_image_url: source.image, cover_image_alt: source.seo.imageAlt || source.title,
      seo_title: source.seo.metaTitle || source.title, seo_description: source.seo.metaDescription || source.excerpt,
      status, published_at: Number.isFinite(date.getTime()) ? date.toISOString() : null,
    }).select("id").single();
    if (result.error) throw new Error(`${result.error.message}. Reload if another editor has already imported this article.`);
    return result.data.id;
  };
  const changeStatus = async (post: Post, status: "published" | "archived" | "draft") => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await ensureStored(post, status);
      if (!post.id.startsWith("bundled--")) {
        const result = await supabase.from("blog_posts").update({ status,
          published_at: status === "published" ? post.published_at || new Date().toISOString() : post.published_at,
          updated_at: new Date().toISOString(),
        }).eq("id", id).select("id").single();
        if (result.error) throw result.error;
      }
      toast.success(`${post.title} is now ${status}`);
      await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Status change failed. Check permissions and try again."); }
    finally { setBusy(false); }
  };
  const beginEdit = async (post: Post) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await ensureStored(post);
      window.location.assign(`${window.location.pathname}/journal/${id}`);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not open the article. Please try again."); setBusy(false); }
  };
  const field = "h-11 w-full border bg-background px-3 text-sm";
  const visiblePosts = posts.filter((post)=>{const needle=search.trim().toLowerCase();return !needle||[post.title,post.slug,post.locale,post.status].some((value)=>value.toLowerCase().includes(needle));});
  return (
    <section>
      <div className="flex justify-between gap-4 mb-7">
        <div>
          <h2 className="font-display text-4xl">Journal</h2>
          <p className="text-sm text-muted-foreground">
            Create articles, save drafts, and publish when ready.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { window.location.assign(`${window.location.pathname}/journal/new`); }}
            className="h-11 bg-foreground text-background px-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <FilePlus2 className="h-4 w-4" />
            New article
          </button>
        </div>
      </div>
      <label className="relative mb-4 block max-w-md"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search articles, language or status" className="h-11 w-full border bg-background pl-10 pr-3 text-sm"/></label>
      <div className="border overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-section">
            <tr className="text-left text-[10px] uppercase tracking-widest">
              <th className="p-4">Article</th>
              <th className="p-4">Language</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visiblePosts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">
                  <strong>{p.title}</strong>
                  <span className="block text-xs text-muted-foreground">/{p.slug}</span>
                </td>
                <td className="p-4 uppercase">{p.locale}</td>
                <td className="p-4 capitalize">{p.status}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => void beginEdit(p)}
                      className="border px-3 py-2 inline-flex gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    {p.status !== "published" && (
                      <button
                        onClick={() => void changeStatus(p, "published")}
                        className="border px-3 py-2 inline-flex gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void changeStatus(p, p.status === "archived" ? "draft" : "archived")
                      }
                      className="border px-3 py-2 inline-flex gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {p.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
