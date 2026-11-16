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
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const query = supabase
      .from("blog_posts")
      .select("id,locale,slug,title,status,published_at")
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setPosts((data ?? []) as Post[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const changeStatus = async (post: Post, status: "published" | "archived" | "draft") => {
    const { error } = await supabase
      .from("blog_posts")
      .update({
        status,
        published_at: status === "published" ? new Date().toISOString() : post.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${post.title} is now ${status}`);
      await load();
    }
  };
  const beginEdit = async (row: Post) => {
    window.open(`${window.location.pathname}/journal/${row.id}`, "_blank", "noopener,noreferrer");
  };
  const importExisting = async () => {
    setImporting(true);
    try {
      const { getAllPosts } = await import("@/lib/blog");
      const existing = getAllPosts();
      for (const source of existing) {
        const locale =
          source.slug.startsWith("come-") || source.slug.startsWith("guida-")
            ? "it"
            : source.slug.startsWith("comment-") || source.slug.startsWith("guide-")
              ? "fr"
              : source.slug.startsWith("como-") || source.slug.startsWith("guia-")
                ? "es"
                : source.slug.startsWith("wie-") || source.slug.startsWith("leitfaden-")
                  ? "de"
                  : "en";
        let coverUrl = source.image;
        const response = await fetch(source.image);
        if (response.ok) {
          const blob = await response.blob();
          const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "webp";
          const path = `${locale}/${source.slug}.${extension}`;
          const upload = await supabase.storage
            .from("blog-media")
            .upload(path, blob, { contentType: blob.type, upsert: true });
          if (upload.error) throw upload.error;
          coverUrl = supabase.storage.from("blog-media").getPublicUrl(path).data.publicUrl;
        }
        const result = await supabase.from("blog_posts").upsert(
          {
            locale,
            slug: source.slug,
            title: source.title,
            excerpt: source.excerpt,
            content_markdown: source.contentMarkdown,
            category: source.category,
            author: source.author,
            cover_image_url: coverUrl,
            cover_image_alt: source.seo.imageAlt ?? source.title,
            seo_title: source.seo.metaTitle ?? source.title,
            seo_description: source.seo.metaDescription ?? source.excerpt,
            status: "published",
            published_at: source.date
              ? new Date(source.date).toISOString()
              : new Date().toISOString(),
          },
          { onConflict: "locale,slug" },
        );
        if (result.error) throw result.error;
      }
      toast.success(`${existing.length} existing articles imported`);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Journal import failed");
    } finally {
      setImporting(false);
    }
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
          {posts.length === 0 && (
            <button
              disabled={importing}
              onClick={() => void importExisting()}
              className="h-11 border px-4 text-xs uppercase tracking-widest"
            >
              {importing ? "Importing…" : "Import existing"}
            </button>
          )}
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
