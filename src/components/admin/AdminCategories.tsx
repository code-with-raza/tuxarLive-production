import { adminCategoryRows, adminCategoryStorefrontHref, isVirtualCategory, readCategoryAudience, persistCategoryAudience } from "@/lib/admin-category-catalogue";
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { Archive, ChevronDown, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { categoryIncludes, categoryLabel } from "@/lib/catalogCategories";
import { PreviewCategoryWorkspace } from "@/components/admin/PreviewCatalogueEditors";
import { isProductForAudience } from "@/lib/product-audience";
type Row = {
  storefrontSlug?: string;
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
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  product_collections?: { collection_slug: string }[];
  price_pence: number;
  status: string;
  product_variants: { stock: number }[];
};
const empty = {
  name: "",
  slug: "",
  description: "",
  status: "active",
  position: "0",
  audience: "both",
  show_hero: true,
  show_description: true,
  show_product_count: true,
  show_filters: true,
};
export function AdminCategories() {
  return import.meta.env.DEV ? <PreviewCategoryWorkspace /> : <DatabaseCategories />;
}
function DatabaseCategories() {
  const [audience, setAudienceState] = useState<"men" | "women" | null>(readCategoryAudience);
  const setAudience = (value: "men" | "women" | null) => { setAudienceState(value); persistCategoryAudience(value); };
  const [rows, setRows] = useState<Row[]>([]),
    [products, setProducts] = useState<ProductRow[]>([]),
    [form, setForm] = useState(empty),
    [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [categoryResult, productResult] = await Promise.all([
      supabase.from("product_categories").select("*").order("position"),
      supabase
        .from("products")
        .select("id,slug,name,category,price_pence,status,product_variants(stock),product_collections(collection_slug)")
        .order("name"),
    ]);
    if (categoryResult.error) toast.error(categoryResult.error.message);
    else setRows((categoryResult.data ?? []) as Row[]);
    if (productResult.error) toast.error(productResult.error.message);
    else setProducts((productResult.data ?? []) as ProductRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const values = {
      ...form,
      position: Number(form.position),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("product_categories").update(values).eq("id", editing)
      : await supabase.from("product_categories").insert(values);
    if (error) toast.error(error.message);
    else {
      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false);
      setEditing(null);
      setForm(empty);
      await load();
    }
  };
  const archive = async (r: Row) => {
    await supabase
      .from("product_categories")
      .update({ status: r.status === "archived" ? "hidden" : "archived" })
      .eq("id", r.id);
    await load();
  };
  const productsFor = (category: Row) =>
    products.filter((product) => categoryIncludes(category.storefrontSlug ?? category.slug, product.category, product.product_collections) && (!audience || isProductForAudience(product, audience)));
  const changeProductCategory = async (product: ProductRow, category: string) => {
    const { error } = await supabase
      .from("products")
      .update({ category, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${product.name} moved to ${categoryLabel(category)}`);
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, category } : item)),
      );
    }
  };
  const remove = async (category: Row) => {
    // Shared categories cannot be deleted while the other audience still has products.
    const assigned = products.filter(product => categoryIncludes(category.slug, product.category, product.product_collections));
    if (assigned.length) {
      toast.error(
        `Move or archive the ${assigned.length} assigned product${assigned.length === 1 ? "" : "s"} before deleting this category.`,
      );
      setExpanded(category.id);
      return;
    }
    if (!window.confirm(`Permanently delete the category “${category.name}”?`)) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category deleted");
      if (expanded === category.id) setExpanded(null);
      await load();
    }
  };
  const field = "mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal";
  if (!audience) return (
    <section>
      <h2 className="mb-6 font-display text-4xl">Categories</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {(["men", "women"] as const).map(value => (
          <button key={value} onClick={() => setAudience(value)} className="border bg-white p-10 text-left font-display text-3xl capitalize">
            {value}
            <span className="mt-3 block font-sans text-sm normal-case text-muted-foreground">View categories, edit details and browse assigned products</span>
          </button>
        ))}
      </div>
    </section>
  );
  const toggle = (key: keyof typeof form, label: string) => (
    <label className="flex items-center gap-3 border p-3 text-sm normal-case tracking-normal">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <section>
      <button className="mb-4 underline" onClick={() => { setAudience(null); setExpanded(null); setOpen(false); }}>← Men / Women</button>
      <div className="mb-7 flex justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl capitalize">{audience} categories</h2>
          <p className="text-sm text-muted-foreground">
            Create storefront categories and control their default page layout.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="border px-4">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setForm({ ...empty, audience });
              setOpen(true);
            }}
            className="h-11 bg-foreground px-5 text-background inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={save} className="mb-8 grid gap-4 border bg-white p-6 md:grid-cols-2">
          <div className="md:col-span-2 flex justify-between">
            <strong>{editing ? "Edit category" : "New category"}</strong>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <label className="text-xs uppercase tracking-widest">
            Name
            <input
              required
              className={field}
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: editing
                    ? form.slug
                    : e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                })
              }
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            URL handle
            <input
              required
              className={field}
              value={form.slug}
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })
              }
            />
          </label>
          <label className="md:col-span-2 text-xs uppercase tracking-widest">
            Description
            <textarea
              className="mt-2 min-h-24 w-full border p-3 normal-case tracking-normal"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Menu audience
            <select
              className={field}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="both">Men and women</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-widest">
            Visibility
            <select
              className={field}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-widest">
            Display order
            <input
              type="number"
              className={field}
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </label>
          <div className="md:col-span-2">
            <p className="mb-2 text-xs uppercase tracking-widest">Default page sections</p>
            <div className="grid gap-2 md:grid-cols-2">
              {toggle("show_hero", "Hero/title section")}
              {toggle("show_description", "Category description")}
              {toggle("show_product_count", "Product count")}
              {toggle("show_filters", "Product filters")}
            </div>
          </div>
          {editing && (
            <div className="md:col-span-2 grid gap-6 lg:grid-cols-2">
              <div className="border p-4">
                <p className="mb-3 text-xs uppercase tracking-widest">Desktop hero image</p>
                <AdminMediaManager
                  entityType="category"
                  entityId={editing}
                  contextName={form.name}
                  scope="website"
                  defaultRole="hero"
                  onUploaded={async (asset) => {
                    const { error } = await supabase
                      .from("product_categories")
                      .update({ hero_media_id: asset.id })
                      .eq("id", editing);
                    if (error) toast.error(error.message);
                    else toast.success("Desktop hero selected");
                  }}
                />
              </div>
              <div className="border p-4">
                <p className="mb-3 text-xs uppercase tracking-widest">Mobile hero image</p>
                <AdminMediaManager
                  entityType="category"
                  entityId={editing}
                  contextName={form.name}
                  scope="website"
                  defaultRole="mobile-hero"
                  onUploaded={async (asset) => {
                    const { error } = await supabase
                      .from("product_categories")
                      .update({ mobile_hero_media_id: asset.id })
                      .eq("id", editing);
                    if (error) toast.error(error.message);
                    else toast.success("Mobile hero selected");
                  }}
                />
              </div>
            </div>
          )}
          {!editing && (
            <p className="md:col-span-2 border bg-section p-4 text-sm text-muted-foreground">
              Save the category first, then edit it to add desktop and mobile hero images.
            </p>
          )}
          <button className="h-12 bg-foreground text-background uppercase tracking-widest text-xs md:col-span-2">
            Save category
          </button>
        </form>
      )}
      <div className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-section text-left text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4">Category</th>
              <th className="p-4">Handle</th>
              <th className="p-4">Audience</th>
              <th className="p-4">Products</th>
              <th className="p-4">Visibility</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adminCategoryRows(rows, audience).map((r) => {
              const assigned = productsFor(r);
              const isExpanded = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className="border-t">
                    <td className="p-4">
                      <strong>{r.name}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {r.description || "No description"}
                      </span>
                    </td>
                    <td className="p-4">
                      <a
                        className="underline"
                        href={adminCategoryStorefrontHref(r, audience)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        /{r.slug}
                      </a>
                    </td>
                    <td className="p-4 capitalize">{r.audience}</td>
                    <td className="p-4">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        className="inline-flex items-center gap-2 border px-3 py-2"
                      >
                        {assigned.length} products
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                    <td className="p-4 capitalize">{r.status}</td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() =>
                          window.location.assign(`${window.location.pathname}/categories/${r.id}?audience=${audience}`)
                        }
                        className="border px-3 py-2 inline-flex gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        disabled={isVirtualCategory(r.id)}
                        onClick={() => void archive(r)}
                        className="border px-3 py-2 inline-flex gap-2"
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                      <button
                        disabled={isVirtualCategory(r.id)}
                        onClick={() => void remove(r)}
                        className="border border-destructive/30 px-3 py-2 inline-flex gap-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t bg-section/60">
                      <td colSpan={6} className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <strong className="font-display text-xl">Products in {r.name}</strong>
                            <p className="text-xs text-muted-foreground">
                              Edit a product or move it to another category.
                            </p>
                          </div>
                        </div>
                        {assigned.length ? (
                          <div className="overflow-x-auto border bg-background">
                            <table className="w-full min-w-[720px] text-sm">
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
                                {assigned.map((product) => (
                                  <tr key={product.id} className="border-t">
                                    <td className="p-3">
                                      <strong>{product.name}</strong>
                                      <span className="block text-xs text-muted-foreground">
                                        /{product.slug}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <select
                                        value={product.category}
                                        onChange={(event) =>
                                          void changeProductCategory(product, event.target.value)
                                        }
                                        className="h-10 min-w-40 border bg-background px-2"
                                      >
                                        {[
                                          ...new Set([
                                            ...rows.map((category) => category.slug),
                                            product.category,
                                          ]),
                                        ].map((slug) => (
                                          <option key={slug} value={slug}>
                                            {categoryLabel(slug)}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      £{(product.price_pence / 100).toFixed(2)}
                                    </td>
                                    <td className="p-3">
                                      {product.product_variants.reduce(
                                        (total, variant) => total + variant.stock,
                                        0,
                                      )}
                                    </td>
                                    <td className="p-3 capitalize">{product.status}</td>
                                    <td className="p-3">
                                      <button
                                        onClick={() =>
                                          window.open(
                                            `${window.location.pathname}/products/${product.id}`,
                                            "_blank",
                                            "noopener,noreferrer",
                                          )
                                        }
                                        className="border px-3 py-2 inline-flex items-center gap-2"
                                      >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="border border-dashed bg-background p-8 text-center text-muted-foreground">
                            No products are assigned to this category.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
