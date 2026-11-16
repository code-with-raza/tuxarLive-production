export type ArticleDraft = {
  id: string;
  locale: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  author: string;
  seo_title: string;
  seo_description: string;
  cover_image_url: string;
  cover_image_alt: string;
  cover_media_id: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
};

export function blankArticle(locale: string, id: string): ArticleDraft {
  return { id, locale, title: "", slug: "", excerpt: "", content_markdown: "", category: "Journal", author: "Tuxar Atelier", seo_title: "", seo_description: "", cover_image_url: "", cover_image_alt: "", cover_media_id: null, status: "draft", published_at: null };
}

export function articleDraftKey(userId: string, locale: string, routeId: string) {
  return `tuxar:article-draft:${userId}:${locale}:${routeId}`;
}

export function readArticleDraft(storage: Pick<Storage, "getItem">, key: string): { post: ArticleDraft; persisted: boolean } | null {
  try {
    const draft = JSON.parse(storage.getItem(key) ?? "null");
    if (!draft || typeof draft.persisted !== "boolean" || !draft.post || typeof draft.post.id !== "string") return null;
    const sample = blankArticle("en", "");
    for (const field of Object.keys(sample) as (keyof ArticleDraft)[]) {
      if (sample[field] === null) {
        if (draft.post[field] !== null && typeof draft.post[field] !== "string") return null;
      } else if (typeof draft.post[field] !== "string") return null;
    }
    if (!["draft", "published", "archived"].includes(draft.post.status)) return null;
    return draft;
  } catch { return null; }
}

export function writeArticleDraft(storage: Pick<Storage, "setItem">, key: string, post: ArticleDraft, persisted: boolean): boolean {
  try { storage.setItem(key, JSON.stringify({ post, persisted })); return true; }
  catch { return false; }
}
