import { persistCategoryAudience } from "@/lib/admin-category-catalogue";
import { useState } from "react";
import { toast } from "sonner";
import { PRODUCTS } from "@/data/products";
import { getLocalCatalogueProduct } from "@/lib/local-catalogue";
import { collectionAudience } from "@/lib/product-audience";
import {
  PREVIEW_CATEGORY_OPTIONS,
  productsInPreviewCategory,
} from "@/lib/preview-category-options";
import { previewCollection, previewProduct, savePreviewEdit } from "@/lib/catalogue-preview-edits";

const field = "mt-2 w-full border bg-background p-3 text-sm";
const localNotice =
  "Local preview: changes are saved in this browser only. Nothing is published to Supabase.";
const currentLocale = () =>
  typeof window === "undefined" ? "en" : window.location.pathname.split("/")[1] || "en";

export function PreviewCategoryWorkspace() {
  const [audience, setAudience] = useState<"men" | "women" | null>(() => {
    const value =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("audience");
    return value === "women" || value === "men" ? value : null;
  });
  const locale = currentLocale();
  if (!audience)
    return (
      <section>
        <h2 className="font-display text-4xl mb-6">Categories</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {(["men", "women"] as const).map((value) => (
            <button
              key={value}
              onClick={() => { setAudience(value); persistCategoryAudience(value); }}
              className="border bg-white p-10 text-left font-display text-3xl capitalize"
            >
              {value}
              <span className="block mt-3 font-sans text-sm text-muted-foreground">
                View categories, edit details and browse assigned products
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  const collections = PREVIEW_CATEGORY_OPTIONS.filter(
    (collection) => collectionAudience(collection.slug) === audience,
  ).map(previewCollection);
  return (
    <section>
      <button className="underline mb-4" onClick={() => { setAudience(null); persistCategoryAudience(null); }}>
        ← Men / Women
      </button>
      <h2 className="font-display text-4xl mb-3 capitalize">{audience} categories</h2>
      <p className="mb-6 text-sm text-muted-foreground">{localNotice}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {collections.map((collection) => {
          const count = productsInPreviewCategory(collection, PRODUCTS).length;
          return (
            <a
              key={collection.slug}
              className="border bg-white p-6"
              href={`/${locale}/admin/categories/preview--${collection.slug}`}
            >
              <h3 className="font-display text-2xl">{collection.title}</h3>
              <p className="text-sm mt-2">{count} products · Edit category →</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function PreviewCategoryEditor({ slug, locale }: { slug: string; locale: string }) {
  const source = PREVIEW_CATEGORY_OPTIONS.find((collection) => collection.slug === slug);
  const [form, setForm] = useState(() => (source ? previewCollection(source) : null));
  if (!form || !source || !import.meta.env.DEV) return <p>Local category not found.</p>;
  const audience = collectionAudience(slug)!;
  const products = productsInPreviewCategory(source, PRODUCTS);
  return (
    <main className="container-luxe py-12 max-w-6xl">
      <a className="underline" href={`/${locale}/admin?section=categories&audience=${audience}`}>
        ← {audience} categories
      </a>
      <h1 className="font-display text-4xl my-6">{form.title}</h1>
      <p className="text-sm mb-6">{localNotice}</p>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            savePreviewEdit("categories", slug, {
              title: form.title,
              description: form.description,
              seoTitle: form.seoTitle || form.title,
              metaIntro: form.metaIntro,
              seoContent: form.seoContent,
            });
            toast.success("Category preview saved in this browser");
          } catch {
            toast.error("Could not save local edits. Check browser storage.");
          }
        }}
      >
        <label>
          Category title
          <input
            required
            className={field}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            className={field}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <label>
          SEO title
          <input
            required
            className={field}
            value={form.seoTitle ?? form.title}
            onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
          />
        </label>
        <label>
          SEO description
          <textarea
            className={field}
            value={form.metaIntro}
            onChange={(event) => setForm({ ...form, metaIntro: event.target.value })}
          />
        </label>
        <label>
          Category content
          <textarea
            className={field}
            value={form.seoContent}
            onChange={(event) => setForm({ ...form, seoContent: event.target.value })}
          />
        </label>
        <button className="bg-foreground text-background p-3">Save local preview</button>
      </form>
      <h2 className="font-display text-3xl mt-10 mb-5">Products ({products.length})</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {products.map((product) => (
          <a
            key={product.slug}
            className="border p-4"
            href={`/${locale}/admin/products/${getLocalCatalogueProduct(product.slug) ? `preview--${product.slug}` : `slug--${product.slug}`}`}
          >
            <img src={product.image} alt={product.name} className="h-48 w-full object-contain" />
            <strong className="block mt-3">{product.name}</strong>
            <span className="text-sm underline">Edit product →</span>
          </a>
        ))}
      </div>
    </main>
  );
}

export function PreviewProductEditor({ slug, locale }: { slug: string; locale: string }) {
  const source = getLocalCatalogueProduct(slug);
  const [form, setForm] = useState(() => (source ? previewProduct(source) : null));
  if (!form || !source || !import.meta.env.DEV) return <p>Local product not found.</p>;
  return (
    <main className="container-luxe max-w-5xl py-12">
      <a href={`/${locale}/admin?section=products`} className="underline">
        ← Products
      </a>
      <h1 className="font-display text-4xl my-6">{form.name}</h1>
      <p className="mb-5">{localNotice} Inventory and publishing remain disabled.</p>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!Number.isFinite(form.priceGBP) || form.priceGBP < 0) return;
          try {
            savePreviewEdit("products", slug, {
              name: form.name,
              tagline: form.tagline,
              description: form.description,
              priceGBP: form.priceGBP,
              seoTitle: form.seoTitle,
              seoDescription: form.seoDescription,
            });
            toast.success("Product preview saved in this browser");
          } catch {
            toast.error("Could not save local edits. Check browser storage.");
          }
        }}
      >
        <label>
          Product title
          <input
            required
            className={field}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Price (£)
          <input
            required
            type="number"
            step="0.01"
            min="0"
            className={field}
            value={form.priceGBP}
            onChange={(event) => setForm({ ...form, priceGBP: Number(event.target.value) })}
          />
        </label>
        <label>
          Tagline
          <input
            className={field}
            value={form.tagline}
            onChange={(event) => setForm({ ...form, tagline: event.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            className={`${field} min-h-40`}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <label>
          SEO title
          <input
            className={field}
            value={form.seoTitle}
            onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
          />
        </label>
        <label>
          SEO description
          <textarea
            className={field}
            value={form.seoDescription}
            onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
          />
        </label>
        <button className="bg-foreground text-background p-3">Save local preview</button>
      </form>
      <div className="grid grid-cols-3 gap-4 mt-8">
        {form.gallery?.map((image) => (
          <img key={image} src={image} alt={form.name} className="w-full object-contain" />
        ))}
      </div>
    </main>
  );
}
