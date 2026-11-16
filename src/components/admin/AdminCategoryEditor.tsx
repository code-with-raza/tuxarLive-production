import { adminCategoryRows, isVirtualCategory } from "@/lib/admin-category-catalogue";
import { collectionAudience } from "@/lib/product-audience";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { categoryIncludes, categoryLabel } from "@/lib/catalogCategories";
import { supabase } from "@/lib/supabase";
import { PreviewCategoryEditor } from "@/components/admin/PreviewCatalogueEditors";
import { isProductForAudience } from "@/lib/product-audience";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  position: number;
  audience: string;
  show_hero: boolean;
  show_description: boolean;
  show_product_count: boolean;
  show_filters: boolean;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  product_collections?: { collection_slug: string }[];
  price_pence: number;
  status: string;
  product_variants: { stock: number }[];
};

export function AdminCategoryEditor({ id, locale }: { id: string; locale: string }) {
  return id.startsWith("preview--") ? <PreviewCategoryEditor slug={id.slice(9)} locale={locale} /> : <DatabaseCategoryEditor id={id} locale={locale} />;
}
function DatabaseCategoryEditor({ id, locale }: { id: string; locale: string }) {
  const requestedAudience = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("audience");
  const audience = requestedAudience === "men" || requestedAudience === "women" ? requestedAudience : null;
  const targetSlug = isVirtualCategory(id) ? id.slice("storefront--".length) : null;
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [categoryResult, categoriesResult, productsResult] = await Promise.all([
      supabase.from("product_categories").select("*").eq(targetSlug ? "slug" : "id", targetSlug ?? id).maybeSingle(),
      supabase.from("product_categories").select("*").order("position"),
      supabase
        .from("products")
        .select("id,slug,name,category,price_pence,status,product_variants(stock),product_collections(collection_slug)")
        .order("name"),
    ]);
    const error = categoryResult.error ?? categoriesResult.error ?? productsResult.error;
    if (error) toast.error(error.message);
    setCategory((categoryResult.data as Category | null) ?? (targetSlug
      ? adminCategoryRows([], audience ?? collectionAudience(targetSlug) ?? "men").find(row => row.slug === targetSlug) ?? null
      : null));
    setCategories((categoriesResult.data ?? []) as Category[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setLoading(false);
  }, [id, targetSlug, audience]);

  useEffect(() => {
    void load();
  }, [load]);

  const storefrontCategory = category && audience ? adminCategoryRows([category], audience).find(row => row.id === category.id) : null;
  const categorySlug = storefrontCategory?.storefrontSlug ?? category?.slug ?? "";
  const assignedProducts = category
    ? products.filter((product) => categoryIncludes(categorySlug, product.category, product.product_collections) && (!audience || isProductForAudience(product, audience)))
    : [];
  const field = "mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!category) return;
    setSaving(true);
    const values = {
        name: category.name.trim(),
        slug: category.slug.trim(),
        description: category.description.trim(),
        status: category.status,
        position: Number(category.position),
        audience: category.audience,
        show_hero: category.show_hero,
        show_description: category.show_description,
        show_product_count: category.show_product_count,
        show_filters: category.show_filters,
        updated_at: new Date().toISOString(),
    };
    const result = isVirtualCategory(category.id)
      ? await supabase.from("product_categories").insert(values).select("*").single()
      : await supabase.from("product_categories").update(values).eq("id", category.id);
    const { error } = result;
    if (!error && result.data) {
      setCategory(result.data as Category);
      const url = new URL(window.location.href);
      url.pathname = `/${locale}/admin/categories/${result.data.id}`;
      window.history.replaceState(window.history.state, "", url);
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Category saved");
  };

  const changeProductCategory = async (product: Product, nextCategory: string) => {
    const { error } = await supabase
      .from("products")
      .update({ category: nextCategory, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${product.name} moved to ${categoryLabel(nextCategory)}`);
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, category: nextCategory } : item,
        ),
      );
    }
  };

  const remove = async () => {
    if (!category || isVirtualCategory(category.id)) return;
    if (products.some(product => categoryIncludes(category.slug, product.category, product.product_collections))) {
      toast.error(
        `Move or archive the ${assignedProducts.length} assigned product${assignedProducts.length === 1 ? "" : "s"} before deleting this category.`,
      );
      return;
    }
    if (!window.confirm(`Permanently delete the category “${category.name}”?`)) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category deleted");
      window.location.assign(`/${locale}/admin?section=categories${audience ? `&audience=${audience}` : ""}`);
    }
  };

  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!category) return <div className="container-luxe py-20">Category not found.</div>;

  const toggle = (key: keyof Category, label: string) => (
    <label className="flex items-center gap-3 border p-3 text-sm normal-case tracking-normal">
      <input
        type="checkbox"
        checked={Boolean(category[key])}
        onChange={(event) => setCategory({ ...category, [key]: event.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <main className="min-h-screen bg-section py-10">
      <div className="container-luxe max-w-6xl">
        <a
          href={`/${locale}/admin?section=categories`}
          className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="h-4 w-4" />
          Categories
        </a>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Category editor</p>
            <h1 className="font-display text-4xl">{category.name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isVirtualCategory(category.id)}
              onClick={() => void remove()}
              className="inline-flex h-11 items-center gap-2 border border-destructive/30 px-4 text-xs uppercase tracking-widest text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button
              form="category-form"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 bg-foreground px-6 text-xs uppercase tracking-widest text-background disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <form id="category-form" onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="space-y-4 border bg-background p-6">
              <h2 className="font-display text-2xl">Category details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-widest">
                  Name
                  <input
                    required
                    className={field}
                    value={category.name}
                    onChange={(event) => setCategory({ ...category, name: event.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-widest">
                  URL handle
                  <input
                    required
                    className={field}
                    value={category.slug}
                    onChange={(event) =>
                      setCategory({
                        ...category,
                        slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                      })
                    }
                  />
                </label>
              </div>
              <label className="block text-xs uppercase tracking-widest">
                Description
                <textarea
                  className="mt-2 min-h-32 w-full border p-3 normal-case tracking-normal"
                  value={category.description}
                  onChange={(event) =>
                    setCategory({ ...category, description: event.target.value })
                  }
                />
              </label>
            </section>

            <section className="space-y-5 border bg-background p-6">
              <div>
                <h2 className="font-display text-2xl">Category images</h2>
                <p className="text-sm text-muted-foreground">
                  Upload an image or paste a URL. Website images are optimized by Cloudinary.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="border p-4">
                  <p className="mb-3 text-xs uppercase tracking-widest">Desktop hero image</p>
                  {isVirtualCategory(category.id) ? <p className="text-sm text-muted-foreground">Save this category before uploading images.</p> : (<AdminMediaManager
                    entityType="category"
                    entityId={category.id}
                    contextName={category.name}
                    scope="website"
                    defaultRole="hero"
                    onUploaded={async (asset) => {
                      const { error } = await supabase
                        .from("product_categories")
                        .update({ hero_media_id: asset.id })
                        .eq("id", category.id);
                      if (error) toast.error(error.message);
                      else toast.success("Desktop hero selected");
                    }}
                  />)}
                </div>
                <div className="border p-4">
                  <p className="mb-3 text-xs uppercase tracking-widest">Mobile hero image</p>
                  {isVirtualCategory(category.id) ? <p className="text-sm text-muted-foreground">Save this category before uploading images.</p> : (<AdminMediaManager
                    entityType="category"
                    entityId={category.id}
                    contextName={category.name}
                    scope="website"
                    defaultRole="mobile-hero"
                    onUploaded={async (asset) => {
                      const { error } = await supabase
                        .from("product_categories")
                        .update({ mobile_hero_media_id: asset.id })
                        .eq("id", category.id);
                      if (error) toast.error(error.message);
                      else toast.success("Mobile hero selected");
                    }}
                  />)}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="space-y-4 border bg-background p-6">
              <h2 className="font-display text-2xl">Publishing</h2>
              <label className="block text-xs uppercase tracking-widest">
                Visibility
                <select
                  className={field}
                  value={category.status}
                  onChange={(event) => setCategory({ ...category, status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="block text-xs uppercase tracking-widest">
                Menu audience
                <select
                  className={field}
                  value={category.audience}
                  onChange={(event) => setCategory({ ...category, audience: event.target.value })}
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="both">Men and women</option>
                </select>
              </label>
              <label className="block text-xs uppercase tracking-widest">
                Display order
                <input
                  type="number"
                  className={field}
                  value={category.position}
                  onChange={(event) =>
                    setCategory({ ...category, position: Number(event.target.value) })
                  }
                />
              </label>
            </section>
            <section className="space-y-3 border bg-background p-6">
              <h2 className="font-display text-2xl">Page layout</h2>
              {toggle("show_hero", "Hero/title section")}
              {toggle("show_description", "Category description")}
              {toggle("show_product_count", "Product count")}
              {toggle("show_filters", "Product filters")}
            </section>
          </aside>
        </form>

        <section className="mt-6 border bg-background p-6">
          <div className="mb-5">
            <h2 className="font-display text-2xl">Products in {category.name}</h2>
            <p className="text-sm text-muted-foreground">
              Edit a product or move it directly to another category.
            </p>
          </div>
          {assignedProducts.length ? (
            <div className="overflow-x-auto border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-section text-left text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedProducts.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="p-3">
                        <strong>{product.name}</strong>
                        <span className="block text-xs text-muted-foreground">/{product.slug}</span>
                      </td>
                      <td className="p-3">
                        <select
                          value={product.category}
                          onChange={(event) =>
                            void changeProductCategory(product, event.target.value)
                          }
                          className="h-10 min-w-44 border bg-background px-2"
                        >
                          {categories.map((item) => (
                            <option key={item.id} value={item.slug}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">£{(product.price_pence / 100).toFixed(2)}</td>
                      <td className="p-3">
                        {product.product_variants.reduce(
                          (total, variant) => total + variant.stock,
                          0,
                        )}
                      </td>
                      <td className="p-3 capitalize">{product.status}</td>
                      <td className="p-3">
                        <a
                          href={`/${locale}/admin/products/${product.id}`}
                          className="inline-flex items-center gap-2 border px-3 py-2"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-dashed p-8 text-center text-muted-foreground">
              No products are assigned to this category.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
