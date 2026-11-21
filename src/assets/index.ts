/**
 * Centralized production-safe asset manifest.
 *
 * Content images are served from verified Cloudinary URLs in the asset manifest.
 *
 * Usage:
 *   import { getProductAsset } from "@/assets";
 *   image: getProductAsset("/src/assets/products/glove/Carbon_Knuckle_front.webp")
 *
 * If the path is not found in the manifest (e.g. a typo or missing file),
 * the function logs a warning in development and returns the original path
 * so the broken image is visible rather than silently missing.
 */

import cloudinaryAssets from "@/data/cloudinary-assets.json";

type CloudinaryMetadata = {
  url: string;
  altText: string;
  title: string;
  width: number;
  height: number;
  format: string;
};

const media = cloudinaryAssets as Record<string, CloudinaryMetadata>;

/**
 * Resolve a `/src/assets/...` path to its Vite-processed production URL.
 *
 * @param srcPath - The source-relative path, e.g. "/src/assets/products/glove/foo.webp"
 * @returns The Vite-hashed URL for production, or the original path as fallback.
 */
export function getProductAsset(srcPath: string): string {
  if (!srcPath) return "";
  // These small editorial originals ship with the site, independently of external media retention.
  const editorial = ["/blog_images/cognac_leather.webp", "/blog_images/italian-leather.webp", "/blog_images/winter.webp"];
  const original = editorial.find(path => path === srcPath || media[path]?.url === srcPath);
  if (original) return original;

  // Normalize: ensure path starts with /src/assets/
  const normalized = srcPath.startsWith("/src/assets/")
    ? srcPath
    : srcPath.startsWith("src/assets/")
      ? `/${srcPath}`
      : srcPath;

  const entry = media[normalized];
  if (entry) {
    return entry.url;
  }

  // Fallback: return original path; will 404 in production but at least won't crash
  if (import.meta.env.DEV) {
    console.warn(`[assets] Image not found in asset manifest: "${srcPath}". Check the file exists in src/assets/`);
  }
  return srcPath;
}

export function getAssetMetadata(srcPath: string): CloudinaryMetadata | undefined {
  const normalized = srcPath.startsWith("/") ? srcPath : `/${srcPath}`;
  return media[normalized];
}
