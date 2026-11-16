import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { PreviewProductEditor } from "@/components/admin/PreviewCatalogueEditors";
import { getProductAsset } from "@/assets";
import { categoryLabel } from "@/lib/catalogCategories";

type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  active: boolean;
};
type Media = { id: string; url: string; alt_text: string; position: number };
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

export function AdminProductEditor({ id, locale }: { id: string; locale: string }) {
  if (id.startsWith("preview--")) return <PreviewProductEditor slug={id.slice(9)} locale={locale} />;
  if (id.startsWith("slug--")) return <ProductSlugEditor slug={id.slice(6)} locale={locale} />;
  return <DatabaseProductEditor id={id} locale={locale} />;
}
function ProductSlugEditor({ slug, locale }: { slug: string; locale: string }) {
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void supabase.from("products").select("id").eq("slug", slug).maybeSingle().then(({ data, error }) => { if (!active) return; if (error) toast.error(error.message); setId(data?.id ?? null); setLoading(false); }); return () => { active = false; }; }, [slug]);
  return loading ? <p>Loading product…</p> : id ? <DatabaseProductEditor id={id} locale={locale} /> : <p>This product is not in the database yet.</p>;
}
function DatabaseProductEditor({ id, locale }: { id: string; locale: string }) {
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<Media[]>([]);
  const [styleCategories, setStyleCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    const result = await supabase
      .from("products")
      .select("*,product_variants(*),product_images(*),product_collections(collection_slug)")
      .eq("id", id)
      .single();
    if (version !== loadVersion.current) return;
    if (result.error) toast.error(result.error.message);
    else {
      const { product_collections: memberships, ...record } = result.data;
      setProduct(record);
      setStyleCategories([...new Set<string>((memberships ?? []).map((item: { collection_slug: string }) => item.collection_slug.replace(/^women-/, "")))]
        .filter(slug => !["best-sellers", "featured-pieces", "new-in", "all", "leather-jackets"].includes(slug)));
      setVariants(result.data.product_variants ?? []);
      setImages(
        (result.data.product_images ?? []).sort((a: Media, b: Media) => a.position - b.position),
      );
    }
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]);
  useEffect(() => {
    void supabase
      .from("product_categories")
      .select("slug")
      .neq("status", "archived")
      .order("position")
      .then(({ data, error }) => {
        if (!error && data?.length) setCategories(data.map((category) => category.slug));
      });
  }, []);
  const field = "h-11 w-full border bg-background px-3 text-sm";
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { product_variants: _, product_images: __, ...values } = product;
    const result = await supabase
      .from("products")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (result.error) {
      toast.error(result.error.message);
      setSaving(false);
      return;
    }
    for (const variant of variants) {
      const variantResult = await supabase
        .from("product_variants")
        .update({
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          color_hex: variant.color_hex,
          stock: Number(variant.stock),
          active: variant.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);
      if (variantResult.error) {
        toast.error(variantResult.error.message);
        setSaving(false);
        return;
      }
    }
    toast.success("Product and inventory saved");
    setSaving(false);
  };
  const saveVariant = async (v: Variant) => {
    const result = await supabase
      .from("product_variants")
      .update({
        sku: v.sku,
        size: v.size,
        color: v.color,
        color_hex: v.color_hex,
        stock: Number(v.stock),
        active: v.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", v.id);
    if (result.error) toast.error(result.error.message);
    else toast.success("Variant saved");
  };
  const toggleVariant = async (v: Variant) => {
    const active = !v.active;
    const result = await supabase
      .from("product_variants")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", v.id);
    if (result.error) toast.error(result.error.message);
    else setVariants((rows) => rows.map((row) => (row.id === v.id ? { ...row, active } : row)));
  };
  const addVariant = async () => {
    const result = await supabase
      .from("product_variants")
      .insert({
        product_id: id,
        sku: `${product.slug}-NEW-${Date.now()}`,
        size: "M",
        color: "Black",
        color_hex: "#111111",
        stock: 0,
      })
      .select()
      .single();
    if (result.error) toast.error(result.error.message);
    else setVariants((v) => [...v, result.data as Variant]);
  };
  const removeVariant = async (v: Variant) => {
    const result = await supabase.from("product_variants").delete().eq("id", v.id);
    if (result.error) toast.error(result.error.message);
    else setVariants((rows) => rows.filter((x) => x.id !== v.id));
  };
  const removeImage = async (media: Media) => {
    const result = await supabase.from("product_images").delete().eq("id", media.id);
    if (result.error) toast.error(result.error.message);
    else setImages((rows) => rows.filter((x) => x.id !== media.id));
  };
  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!product) return <div className="container-luxe py-20">Product not found.</div>;
  return (
    <main className="bg-section min-h-screen py-10">
      <div className="container-luxe max-w-6xl">
        <a
          href={(() => {
            const previous = new URLSearchParams(window.location.search).get("returnTo");
            return previous?.startsWith(`/${locale}/admin?section=products`) ? previous : `/${locale}/admin?section=products`;
          })()}
          className="inline-flex gap-2 text-xs uppercase tracking-widest mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Products
        </a>
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="eyebrow">Product editor</p>
            <h1 className="font-display text-4xl">{product.name}</h1>
          </div>
          <button
            form="product-form"
            disabled={saving}
            className="h-11 bg-foreground text-background px-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <form id="product-form" onSubmit={save} className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Product details</h2>
              <label className="block text-xs uppercase tracking-widest">
                Title
                <input
                  className={`${field} mt-2`}
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                />
              </label>
              <RichTextEditor
                label="Product description"
                value={product.description}
                onChange={(description) => setProduct({ ...product, description })}
                minHeight="220px"
              />
              <label className="block text-xs uppercase tracking-widest">
                Tagline
                <input
                  className={`${field} mt-2`}
                  value={product.tagline}
                  onChange={(e) => setProduct({ ...product, tagline: e.target.value })}
                />
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-xs uppercase tracking-widest">
                  Selling price (GBP / EUR)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    className={`${field} mt-2`}
                    value={product.price_pence / 100}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        price_pence: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </label>
                <label className="text-xs uppercase tracking-widest">
                  Compare-at price (GBP / EUR){" "}
                  <span className="normal-case tracking-normal text-muted-foreground">
                    (optional)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    className={`${field} mt-2`}
                    value={product.compare_price_pence ? product.compare_price_pence / 100 : ""}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        compare_price_pence: e.target.value
                          ? Math.round(Number(e.target.value) * 100)
                          : null,
                      })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="bg-background border p-6">
              <div className="mb-4">
                <h2 className="font-display text-2xl">Media</h2>
              </div>
              <AdminMediaManager
                entityType="product"
                entityId={id}
                contextName={product.name}
                scope="website"
                defaultRole="gallery"
                compact
                onUploaded={async (asset) => {
                  const { error } = await supabase.from("product_images").insert({
                    product_id: id,
                    url: asset.secure_url,
                    alt_text: asset.alt_text,
                    position: images.length,
                    media_asset_id: asset.id,
                  });
                  if (error) toast.error(error.message);
                  else await load();
                }}
              />
              {images.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative border aspect-square bg-section">
                      <img
                        src={getProductAsset(image.url)}
                        alt={image.alt_text}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => void removeImage(image)}
                        className="absolute right-2 top-2 bg-background border p-2"
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No images uploaded.</p>
              )}
            </section>
            <section className="bg-background border p-6">
              <div className="flex justify-between mb-4">
                <div>
                  <h2 className="font-display text-2xl">Variants and inventory</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage every size, colour, SKU and stock quantity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void addVariant()}
                  className="border px-3 inline-flex items-center gap-2 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <div className="hidden md:grid grid-cols-[1.5fr_.6fr_1fr_.6fr_auto_auto_auto] gap-2 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>SKU</span>
                <span>Size</span>
                <span>Colour</span>
                <span>Stock</span>
                <span>Visible</span>
                <span>Save</span>
                <span>Remove</span>
              </div>
              <div className="space-y-3">
                {variants.map((v, index) => (
                  <div
                    key={v.id}
                    className={`grid grid-cols-2 md:grid-cols-[1.5fr_.6fr_1fr_.6fr_auto_auto_auto] gap-2 items-center ${v.active ? "" : "opacity-50"}`}
                  >
                    <label>
                      <span className="md:hidden text-[10px] uppercase">SKU</span>
                      <input
                        aria-label="SKU"
                        className={field}
                        value={v.sku}
                        onChange={(e) =>
                          setVariants((rows) =>
                            rows.map((x, i) => (i === index ? { ...x, sku: e.target.value } : x)),
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className="md:hidden text-[10px] uppercase">Size</span>
                      <input
                        aria-label="Size"
                        className={field}
                        value={v.size}
                        onChange={(e) =>
                          setVariants((rows) =>
                            rows.map((x, i) => (i === index ? { ...x, size: e.target.value } : x)),
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className="md:hidden text-[10px] uppercase">Colour</span>
                      <input
                        aria-label="Colour"
                        className={field}
                        value={v.color}
                        onChange={(e) =>
                          setVariants((rows) =>
                            rows.map((x, i) => (i === index ? { ...x, color: e.target.value } : x)),
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className="md:hidden text-[10px] uppercase">Stock</span>
                      <input
                        aria-label="Stock"
                        type="number"
                        min="0"
                        className={field}
                        value={v.stock}
                        onChange={(e) =>
                          setVariants((rows) =>
                            rows.map((x, i) =>
                              i === index ? { ...x, stock: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void toggleVariant(v)}
                      aria-label={v.active ? "Hide variant" : "Show variant"}
                      title={v.active ? "Visible — click to hide" : "Hidden — click to show"}
                      className="border h-11 px-3 grid place-items-center"
                    >
                      {v.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveVariant(v)}
                      className="border h-11 px-3 text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeVariant(v)}
                      className="border h-11 px-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-6">
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Publishing</h2>
              <select
                className={field}
                value={product.status}
                onChange={(e) => setProduct({ ...product, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <label className="block text-xs uppercase tracking-widest">
                Catalogue group
                <select
                  className={`${field} mt-2`}
                  value={product.category}
                  onChange={(e) => setProduct({ ...product, category: e.target.value })}
                >
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              {styleCategories.length > 0 && <div className="text-sm">
                <span className="block text-xs uppercase tracking-widest mb-2">Style categories</span>
                {styleCategories.map(slug => categoryLabel(slug)).join(", ")}
              </div>}
            </section>
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Organization</h2>
              <label className="block text-xs uppercase tracking-widest">
                URL handle
                <input
                  className={`${field} mt-2`}
                  value={product.slug}
                  onChange={(e) => setProduct({ ...product, slug: e.target.value })}
                />
              </label>
              <label className="block text-xs uppercase tracking-widest">
                Material
                <input
                  className={`${field} mt-2`}
                  value={product.material}
                  onChange={(e) => setProduct({ ...product, material: e.target.value })}
                />
              </label>
              <label className="block text-xs uppercase tracking-widest">
                Weight
                <input
                  className={`${field} mt-2`}
                  value={product.weight}
                  onChange={(e) => setProduct({ ...product, weight: e.target.value })}
                />
              </label>
            </section>
            <section className="bg-background border p-6 space-y-4">
              <h2 className="font-display text-2xl">Search engine listing</h2>
              <input
                className={field}
                placeholder="SEO title"
                value={product.seo_title}
                onChange={(e) => setProduct({ ...product, seo_title: e.target.value })}
              />
              <textarea
                className="w-full min-h-28 border p-3"
                maxLength={160}
                placeholder="SEO description"
                value={product.seo_description}
                onChange={(e) => setProduct({ ...product, seo_description: e.target.value })}
              />
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}
