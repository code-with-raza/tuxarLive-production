import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Archive,
  Loader2,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PRODUCTS as STOREFRONT_PRODUCTS } from "@/data/products";
import { getLocalCatalogueProduct, LOCAL_JACKET_PRODUCTS } from "@/lib/local-catalogue";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { categoryLabel, categoryIncludes } from "@/lib/catalogCategories";
import { formatCataloguePrice } from "@/lib/order-money";
import { normaliseCatalogueSearch, previewAdminRows } from "@/lib/admin-catalogue-preview";

// Reviewing local drafts must never make the existing database import button
// publish them to the configured (possibly production) Supabase project.
const PRODUCTS = STOREFRONT_PRODUCTS.filter((product) => !getLocalCatalogueProduct(product.slug));

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
const fallbackCategories = [
  "leather-jackets",
  "motorcycle-suits",
  "leather-bags",
  "accessories",
  "varsity",
  "bomber",
  "racing",
  "classic",
  "flight_jacket",
];
const initial = {
  name: "",
  slug: "",
  category: "leather-jackets",
  price: "",
  tagline: "",
  description: "",
  material: "",
  weight: "",
  seoTitle: "",
  seoDescription: "",
  sku: "",
  size: "M",
  color: "Black",
  colorHex: "#111111",
  stock: "0",
  status: "draft",
};

export function AdminCatalog() {
  const savedFilters = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const missingCount = PRODUCTS.filter((source) => !products.some((product) => product.slug === source.slug)).length;
  const [categories, setCategories] = useState(fallbackCategories);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [statusView, setStatusView] = useState(savedFilters.get("status") || "all");
  const [search, setSearch] = useState(savedFilters.get("q") || "");
  const [categoryFilter, setCategoryFilter] = useState(savedFilters.get("category") || "all");
  const [stockFilter, setStockFilter] = useState(savedFilters.get("stock") || "all");
  const [minPrice, setMinPrice] = useState(savedFilters.get("min") || "");
  const [maxPrice, setMaxPrice] = useState(savedFilters.get("max") || "");
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "products");
    for (const [key, value] of Object.entries({status:statusView,q:search,category:categoryFilter,stock:stockFilter,min:minPrice,max:maxPrice})) {
      if (value && value !== "all") url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    window.history.replaceState({},"",url);
  }, [statusView,search,categoryFilter,stockFilter,minPrice,maxPrice]);
  useEffect(() => {
    const offset = Number(new URLSearchParams(window.location.search).get("catalogScroll"));
    if (products.length && Number.isFinite(offset) && offset > 0 && offset < 10000000) window.scrollTo(0,offset);
  }, [products.length]);
  const load = useCallback(async () => {
    let query = supabase
      .from("products")
      .select("id,slug,name,category,price_pence,status,product_variants(stock),product_collections(collection_slug)")
      .order("created_at", { ascending: false });
    if (statusView !== "all") query = query.eq("status", statusView);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setProducts([
      ...((data ?? []) as ProductRow[]),
      ...previewAdminRows(data ?? [], LOCAL_JACKET_PRODUCTS, statusView),
    ]);
  }, [statusView]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void supabase
      .from("product_categories")
      .select("slug")
      .neq("status", "archived")
      .order("position")
      .then(({ data }) => {
        if (data?.length) setCategories(data.map((category) => category.slug));
      });
  }, []);
  const set = (key: keyof typeof initial, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const values = {
        slug: form.slug,
        name: form.name,
        category: form.category,
        price_pence: Math.round(Number(form.price) * 100),
        tagline: form.tagline,
        description: form.description,
        material: form.material,
        weight: form.weight,
        seo_title: form.seoTitle,
        seo_description: form.seoDescription,
        status: form.status,
      };
      const request = editingId
        ? supabase
            .from("products")
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq("id", editingId)
        : supabase.from("products").insert(values);
      const { data: product, error } = await request.select("id").single();
      if (error) throw error;
      if (!editingId) {
        const variant = await supabase.from("product_variants").insert({
          product_id: product.id,
          sku: form.sku,
          size: form.size,
          color: form.color,
          color_hex: form.colorHex,
          stock: Number(form.stock),
        });
        if (variant.error) throw variant.error;
      }
      if (!editingId) {
        toast.success("Product created. You can now add images by upload or URL.");
        setEditingId(product.id);
        await load();
        return;
      }
      toast.success("Product updated");
      setForm(initial);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Product creation failed");
    } finally {
      setBusy(false);
    }
  };
  const status = async (product: ProductRow, next: string) => {
    if (product.id.startsWith("preview--")) { toast.info("Local preview only. Publishing and archiving are disabled."); return; }
    const { error } = await supabase
      .from("products")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${product.name} is now ${next}`);
      await load();
    }
  };
  const beginEdit = async (row: ProductRow) => {
    const previous = new URL(window.location.href);
    previous.searchParams.set("section","products");
    previous.searchParams.set("catalogScroll",String(window.scrollY));
    const returnTo = previous.pathname + previous.search;
    window.open(`${window.location.pathname}/products/${row.id}?returnTo=${encodeURIComponent(returnTo)}`, "_blank", "noopener,noreferrer");
  };
  const changeCategory = async (product: ProductRow, category: string) => {
    if (product.id.startsWith("preview--")) { toast.info("Local preview category assignments are managed in the local catalogue."); return; }
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
  const importExisting = async () => {
    setImporting(true);
    try {
      for (const source of PRODUCTS) {
        const existing = await supabase.from("products").select("id").eq("slug", source.slug).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) continue;
        const { data: product, error } = await supabase
          .from("products")
          .upsert(
            {
              slug: source.slug,
              name: source.name,
              tagline: source.tagline,
              description: source.description,
              category: source.category,
              price_pence: Math.round(source.priceGBP * 100),
              compare_price_pence: source.comparePriceGBP
                ? Math.round(source.comparePriceGBP * 100)
                : null,
              material: source.material,
              weight: source.weight,
              origin: source.origin ?? null,
              badge: source.badge ?? null,
              seo_title: source.name,
              seo_description: source.description.slice(0, 160),
              status: "active",
            },
            { onConflict: "slug" },
          )
          .select("id")
          .single();
        if (error) throw error;
        await supabase.from("product_variants").delete().eq("product_id", product.id);
        const variants = source.colors.flatMap((color) =>
          source.sizes.map((size) => ({
            product_id: product.id,
            sku: `${source.slug}-${color.name}-${size}`
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "-")
              .slice(0, 80),
            size,
            color: color.name,
            color_hex: color.hex,
            stock: 0,
          })),
        );
        if (variants.length) {
          const result = await supabase.from("product_variants").insert(variants);
          if (result.error) throw result.error;
        }
        await supabase.from("product_images").delete().eq("product_id", product.id);
        const urls = [...new Set(source.gallery.length ? source.gallery : [source.image])];
        for (let position = 0; position < urls.length; position++) {
          const imageResult = await supabase
            .from("product_images")
            .insert({ product_id: product.id, url: urls[position], alt_text: source.name, position });
          if (imageResult.error) throw imageResult.error;
        }
        await supabase.from("product_collections").delete().eq("product_id", product.id);
        if (source.collections?.length) {
          const collectionResult = await supabase.from("product_collections").insert(
            source.collections.map((collection_slug) => ({
              product_id: product.id,
              collection_slug,
            })),
          );
          if (collectionResult.error) throw collectionResult.error;
        }
      }
      toast.success("Missing catalog products added with zero stock. Set verified stock before selling.");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Catalog import failed");
    } finally {
      setImporting(false);
    }
  };
  const field = "h-11 w-full border bg-background px-3 text-sm";
  const visibleProducts = products.filter((product) => {
    const needle = normaliseCatalogueSearch(search);
    const stock = product.product_variants.reduce((total, variant) => total + variant.stock, 0);
    const price = product.price_pence / 100;
    return (
      (!needle ||
        [product.name, product.slug, product.category, product.status].some((value) =>
          normaliseCatalogueSearch(value).includes(needle),
        )) &&
      (categoryFilter === "all" || categoryIncludes(categoryFilter, product.category, product.product_collections)) &&
      (stockFilter === "all" ||
        (stockFilter === "out" && stock === 0) ||
        (stockFilter === "low" && stock > 0 && stock <= 10) ||
        (stockFilter === "in" && stock > 10)) &&
      (!minPrice || price >= Number(minPrice)) &&
      (!maxPrice || price <= Number(maxPrice))
    );
  });
  return (
    <section>
      <div className="flex justify-end mb-4">
        <label className="text-xs uppercase tracking-widest">
          View{" "}
          <select
            value={statusView}
            onChange={(e) => setStatusView(e.target.value)}
            className="ml-2 h-10 border bg-background px-3 normal-case tracking-normal"
          >
            <option value="all">All products</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived products</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap justify-between gap-4 mb-7">
        <div>
          <h2 className="font-display text-4xl">Products</h2>
          <p className="text-sm text-muted-foreground">
            Products are archived instead of permanently deleted.
          </p>
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && (
            <button
              disabled={importing}
              onClick={() => void importExisting()}
              className="border px-4 text-xs uppercase tracking-widest"
            >
              {importing ? "Adding…" : `Add missing (${missingCount})`}
            </button>
          )}
          <button
            onClick={() => void load()}
            className="border px-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-foreground text-background px-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <PackagePlus className="h-4 w-4" />
            Add product
          </button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={submit} className="border bg-surface p-6 mb-8 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex justify-between">
            <strong>{editingId ? "Edit product" : "New product"}</strong>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(initial);
              }}
              className="text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
          <input
            required
            className={field}
            placeholder="Product name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <input
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className={field}
            placeholder="URL slug"
            value={form.slug}
            onChange={(e) =>
              set(
                "slug",
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              )
            }
          />
          <select
            className={field}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            className={field}
            placeholder="Price (GBP / EUR)"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          <input
            className={field}
            placeholder="Tagline"
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
          />
          <input
            className={field}
            placeholder="Material"
            value={form.material}
            onChange={(e) => set("material", e.target.value)}
          />
          <textarea
            required
            className="min-h-28 border bg-background p-3 md:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
          {!editingId && (
            <>
              <input
                required
                className={field}
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value.toUpperCase())}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  required
                  className={field}
                  placeholder="Size"
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                />
                <input
                  required
                  className={field}
                  placeholder="Colour"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                />
                <input
                  required
                  min="0"
                  type="number"
                  className={field}
                  placeholder="Stock"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </div>
            </>
          )}
          <input
            className={field}
            placeholder="SEO title"
            value={form.seoTitle}
            onChange={(e) => set("seoTitle", e.target.value)}
          />
          <input
            className={field}
            maxLength={160}
            placeholder="SEO description"
            value={form.seoDescription}
            onChange={(e) => set("seoDescription", e.target.value)}
          />
          {editingId ? (
            <div className="md:col-span-2 border p-4">
              <p className="mb-3 text-xs uppercase tracking-widest">Product images</p>
              <AdminMediaManager
                entityType="product"
                entityId={editingId}
                contextName={form.name}
                scope="website"
                defaultRole="gallery"
                onUploaded={async (asset) => {
                  const { count } = await supabase
                    .from("product_images")
                    .select("id", { count: "exact", head: true })
                    .eq("product_id", editingId);
                  const { error } = await supabase.from("product_images").insert({
                    product_id: editingId,
                    url: asset.secure_url,
                    alt_text: asset.alt_text,
                    position: count ?? 0,
                    media_asset_id: asset.id,
                  });
                  if (error) toast.error(error.message);
                }}
              />
            </div>
          ) : (
            <p className="md:col-span-2 border bg-section p-4 text-sm text-muted-foreground">
              Save the product first. The upload and image URL options will then appear here.
            </p>
          )}
          <select
            className={field}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
          <button
            disabled={busy}
            className="h-12 bg-foreground text-background uppercase tracking-widest text-xs md:col-span-2"
          >
            {busy ? (
              <Loader2 className="animate-spin mx-auto" />
            ) : editingId ? (
              "Save changes"
            ) : (
              "Save product"
            )}
          </button>
        </form>
      )}
      <div className="mb-5 border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
          <SlidersHorizontal className="h-4 w-4" /> Filters
          <span className="ml-auto normal-case tracking-normal text-muted-foreground">
            {visibleProducts.length} of {products.length} products
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block xl:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, handle or status"
              className="h-11 w-full border bg-background pl-10 pr-3 text-sm"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={field}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {[...new Set(products.map((product) => product.category))].sort().map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
            className={field}
            aria-label="Filter by stock"
          >
            <option value="all">All inventory</option>
            <option value="in">In stock (11+)</option>
            <option value="low">Low stock (1–10)</option>
            <option value="out">Out of stock</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Min price"
              className={field}
            />
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Max price"
              className={field}
            />
          </div>
        </div>
      </div>
      <div className="border overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-section">
            <tr className="text-left text-[10px] uppercase tracking-widest">
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">
                  <strong>{p.name}</strong>
                  {p.id.startsWith("preview--") && <span className="block text-xs text-muted-foreground">Local preview · not published</span>}
                  <span className="block text-xs text-muted-foreground">/{p.slug}</span>
                </td>
                <td className="p-4">
                  <select
                    value={p.category}
                    disabled={p.id.startsWith("preview--")}
                    onChange={(event) => void changeCategory(p, event.target.value)}
                    className="h-10 min-w-40 border bg-background px-2 text-sm"
                    aria-label={`Change category for ${p.name}`}
                  >
                    {[...new Set([...categories, p.category])].map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4">{formatCataloguePrice(p.price_pence)}</td>
                <td className="p-4">{p.product_variants.reduce((n, v) => n + v.stock, 0)}</td>
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
                    <button
                      onClick={() => void status(p, p.status === "archived" ? "draft" : "archived")}
                      disabled={p.id.startsWith("preview--")}
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
