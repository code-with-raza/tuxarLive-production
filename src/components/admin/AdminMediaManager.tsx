import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Archive, ImagePlus, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cloudinaryUrl, seoSlug, type CloudinaryAsset } from "@/lib/cloudinary";
type Media = {
  id: string;
  secure_url: string;
  alt_text: string;
  title: string;
  media_role: string;
  position: number;
  width: number | null;
  height: number | null;
  format: string | null;
  public_id: string | null;
};
type Props = {
  entityType: string;
  entityId?: string;
  entityKey?: string;
  contextName: string;
  scope?: "website" | "email";
  defaultRole?: string;
  onUploaded?: (asset: Media) => void;
  onSelect?: (asset: Media) => void;
  compact?: boolean;
};
export function AdminMediaManager({
  entityType,
  entityId,
  entityKey,
  contextName,
  scope = "website",
  defaultRole = "gallery",
  onUploaded,
  onSelect,
  compact,
}: Props) {
  const [items, setItems] = useState<Media[]>([]),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [mode, setMode] = useState<"file" | "url">("file");
  const fileInput = useRef<HTMLInputElement>(null);
  const openFilePicker = () => {
    if (busy) return;
    setMode("file");
    // Keep this synchronous with the user's click so browsers allow the picker.
    // The input stays mounted even while the URL-import controls are displayed.
    fileInput.current?.click();
  };
  const filter = useCallback(() => {
    let q = supabase
      .from("media_assets")
      .select("id,secure_url,alt_text,title,media_role,position,width,height,format,public_id")
      .eq("entity_type", entityType)
      .eq("media_role", defaultRole)
      .eq("status", "active");
    q = entityId ? q.eq("entity_id", entityId) : q.eq("entity_key", entityKey ?? "");
    return q.order("position");
  }, [entityType, entityId, entityKey, defaultRole]);
  const load = useCallback(async () => {
    const { data } = await filter();
    setItems((data ?? []) as Media[]);
  }, [filter]);
  useEffect(() => {
    void load();
  }, [load]);
  const upload = async (file: File | string) => {
    setBusy(true);
    try {
      if (typeof file === "string" && !/^https:\/\//i.test(file))
        throw new Error("Enter a secure HTTPS image URL");
      const role = defaultRole,
        base = seoSlug(contextName) || "image",
        publicId = `${base}-${role}-${Date.now()}`;
      const { data: sign, error } = await supabase.functions.invoke("cloudinary-sign-upload", {
        body: { scope, folder: `${entityType}/${base}`, publicId },
      });
      if (error || sign?.error) throw new Error(sign?.error || error?.message);
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sign.apiKey);
      body.append("timestamp", String(sign.timestamp));
      body.append("signature", sign.signature);
      body.append("folder", sign.folder);
      body.append("public_id", sign.publicId);
      body.append("overwrite", "false");
      body.append("allowed_formats", sign.allowedFormats);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: "POST", body },
      );
      const cloud = (await response.json()) as CloudinaryAsset & { error?: { message: string } };
      if (!response.ok) throw new Error(cloud.error?.message || "Cloudinary upload failed");
      const angle = role.replace(/[-_]+/g, " ");
      const alt =
        scope === "email"
          ? `${contextName} promotional banner`
          : `${angle.charAt(0).toUpperCase() + angle.slice(1)} of ${contextName}`;
      const values = {
        provider: "cloudinary",
        public_id: cloud.public_id,
        secure_url: cloud.secure_url,
        original_url: typeof file === "string" ? file : null,
        original_filename: typeof file === "string" ? file.split("/").pop() || base : file.name,
        seo_filename: publicId,
        alt_text: alt,
        title: `${contextName} — ${angle}`,
        width: cloud.width,
        height: cloud.height,
        format: cloud.format,
        bytes: cloud.bytes,
        media_scope: scope,
        entity_type: entityType,
        entity_id: entityId ?? null,
        entity_key: entityKey ?? null,
        media_role: role,
        position: items.length,
      };
      const { data: saved, error: savedError } = await supabase
        .from("media_assets")
        .insert(values)
        .select()
        .single();
      if (savedError) throw savedError;
      toast.success("Image added to Cloudinary");
      setUrl("");
      await load();
      onUploaded?.(saved as Media);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  };
  const fileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    // Allow choosing the same file again after a failed/oversized upload.
    e.currentTarget.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    void upload(file);
  };
  const archive = async (id: string) => {
    await supabase
      .from("media_assets")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);
    await load();
  };
  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        aria-label="Choose image file"
        accept={scope === "email" ? "image/jpeg,image/png,image/gif,image/webp" : "image/jpeg,image/png,image/webp,image/avif"}
        className="hidden"
        disabled={busy}
        onChange={fileChange}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={busy}
          className={`border px-3 py-2 text-xs uppercase tracking-wider ${mode === "file" ? "bg-foreground text-background" : ""}`}
        >
          <ImagePlus className="mr-2 inline h-4 w-4" />
          Add image
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          disabled={busy}
          className={`border px-3 py-2 text-xs uppercase tracking-wider ${mode === "url" ? "bg-foreground text-background" : ""}`}
        >
          <Link2 className="mr-2 inline h-4 w-4" />
          Add URL
        </button>
        <button type="button" onClick={() => void load()} className="border px-3">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {mode === "file" ? (
        <button type="button" disabled={busy} onClick={openFilePicker} className="flex min-h-24 w-full cursor-pointer items-center justify-center border border-dashed bg-section text-sm disabled:cursor-wait">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Choose an image (maximum 5 MB)"}
        </button>
      ) : (
        <div className="flex">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-11 min-w-0 flex-1 border px-3"
          />
          <button
            type="button"
            disabled={busy || !url}
            onClick={() => void upload(url)}
            className="border border-l-0 px-5 text-xs uppercase tracking-wider"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      )}
      {!compact && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="relative border bg-white p-2">
              <img
                src={cloudinaryUrl(item.secure_url, {
                  width: 420,
                  ...(entityType === "homepage-banner" ? { crop: "fit" as const } : { height: 300 }),
                  email: scope === "email",
                })}
                alt={item.alt_text}
                className={`h-36 w-full ${entityType === "homepage-banner" ? "object-contain bg-zinc-950" : "object-cover"}`}
              />
              <p className="mt-2 truncate text-xs font-medium">{item.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{item.alt_text}</p>
              {onSelect && <button type="button" disabled={busy} onClick={() => onSelect(item)} className="mt-3 border px-3 py-2 text-xs">Use this image</button>}
              <button
                type="button"
                onClick={() => void archive(item.id)}
                className="absolute right-3 top-3 bg-white p-2 shadow"
                aria-label="Archive image"
              >
                <Archive className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
