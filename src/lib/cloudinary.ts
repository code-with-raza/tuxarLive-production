export type CloudinaryAsset = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  original_filename: string;
};
export function cloudinaryUrl(
  url: string,
  options: { width?: number; height?: number; crop?: "fill" | "fit"; email?: boolean } = {},
) {
  if (!url.includes("/image/upload/")) return url;
  const parts = [
    options.email ? "f_jpg" : "f_auto",
    options.email ? "q_auto:good" : "q_auto",
    options.width && `w_${options.width}`,
    options.height && `h_${options.height}`,
    (options.width || options.height) && `c_${options.crop ?? "fill"}`,
  ]
    .filter(Boolean)
    .join(",");
  return url.replace("/image/upload/", `/image/upload/${parts}/`);
}
export function seoSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/** Consistent bag-card canvas without cropping handles or stretching products. */
export function bagImageUrl(url: string, width: number, height: number) {
  if (!url.includes("/image/upload/")) return url;
  // The supplied studio PNGs have unequal outer white margins. Older catalogue
  // photos can include scenery, so retain their complete original composition.
  const trim = /\/[^/]+-\d{2}\.png$/.test(new URL(url).pathname) ? "e_trim:10/" : "";
  const innerWidth = Math.round(width * 0.84);
  const innerHeight = Math.round(height * 0.84);
  return url.replace("/image/upload/", `/image/upload/${trim}c_fit,w_${innerWidth},h_${innerHeight}/c_lpad,w_${width},h_${height},b_white,g_center/f_auto,q_auto/`);
}
