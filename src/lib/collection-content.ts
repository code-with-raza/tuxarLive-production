import type { Collection } from "@/data/products";
import type { Locale } from "@/i18n/i18n";

export const COLLECTION_CONTENT_LOCALES = ["en", "de", "fr", "it", "es"] as const;
export type CollectionFields = { name: string; description: string; seo_title: string; seo_description: string };
export type CollectionContentRow = {
  id: string; slug: string; name: string; description: string;
  seo_title?: string; seo_description?: string;
  content_translations?: Partial<Record<Locale, Partial<CollectionFields>>>;
  updated_at?: string;
};

export function collectionEditorContent(row: CollectionContentRow, locale: Locale, fallback?: Collection): CollectionFields {
  const source = locale === "en" ? row : row.content_translations?.[locale];
  return {
    name: typeof source?.name === "string" ? source.name : fallback?.title ?? "",
    description: typeof source?.description === "string" ? source.description : fallback?.description ?? "",
    seo_title: typeof source?.seo_title === "string" ? source.seo_title : "",
    seo_description: typeof source?.seo_description === "string" ? source.seo_description : "",
  };
}

/** Apply saved content after built-in localization; English never replaces another language. */
export function applyCollectionContent(fallback: Collection, row: CollectionContentRow | null, locale: Locale): Collection {
  const source = locale === "en" ? row : row?.content_translations?.[locale];
  if (!source) return fallback;
  return {
    ...fallback,
    title: typeof source.name === "string" && source.name.trim() ? source.name : fallback.title,
    description: typeof source.description === "string" ? source.description : fallback.description,
    seoTitle: typeof source.seo_title === "string" && source.seo_title.trim() ? source.seo_title.trim() : fallback.seoTitle,
    seoDescription: typeof source.seo_description === "string" && source.seo_description.trim() ? source.seo_description.trim() : fallback.seoDescription,
  };
}

export function collectionEditValues(row: CollectionContentRow, edits: Partial<Record<Locale, CollectionFields>>) {
  const english = edits.en ?? collectionEditorContent(row, "en");
  if (!english.name.trim()) throw new Error("Enter a collection name before saving.");
  const translations = { ...row.content_translations };
  for (const locale of COLLECTION_CONTENT_LOCALES) {
    const content = edits[locale];
    if (!content || locale === "en") continue;
    if (!content.name.trim()) throw new Error(`Enter a collection name for ${locale.toUpperCase()}.`);
    translations[locale] = { ...translations[locale], ...content, name: content.name.trim(), description: content.description.trim(), seo_title: content.seo_title.trim(), seo_description: content.seo_description.trim() };
  }
  return { name: english.name.trim(), description: english.description.trim(), seo_title: english.seo_title.trim(), seo_description: english.seo_description.trim(), content_translations: translations };
}

export function collectionPersistenceError(error: { code?: string; message?: string }) {
  if (error.code === "PGRST204" || error.code === "42703") return "Collection SEO database fields are not installed yet. Apply the pending collection metadata migration through the deployment workflow, then save again.";
  if (error.code === "PGRST116") return "The collection changed or could not be updated. Keep your edits, reload the saved record and check your staff permissions before retrying.";
  if (error.code === "42501" || error.code === "PGRST301") return "Collection was not saved. Sign in again and confirm your staff account has collection-editing permission, then retry.";
  if (error.code === "23505") return "Collection was not saved because that URL handle is already used. Keep the existing handle or choose a unique one.";
  return `Collection was not saved: ${error.message || "the server could not confirm persistence"}. Check your connection and staff sign-in, then retry.`;
}

/** Returning exactly one saved row prevents false success on an RLS-filtered update. */
export async function persistCollectionContent(client: { from: (table: string) => any }, row: CollectionContentRow, values: Record<string, unknown>) {
  let query = row.id.startsWith("storefront--")
    ? client.from("product_categories").insert(values)
    : client.from("product_categories").update(values).eq("id", row.id);
  if (!row.id.startsWith("storefront--") && row.updated_at) query = query.eq("updated_at", row.updated_at);
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(collectionPersistenceError(error));
  if (!data) throw new Error("The server did not confirm the saved collection. Keep your edits and retry.");
  return data;
}
