import { cloudinaryUrl } from "./cloudinary";

// Keep the preload and the rendered image candidates identical.
export function heroImageSources(url: string) {
  return [[480, 760], [640, 900], [960, 900], [1280, 720], [1920, 1080]]
    .map(([width, height]) => `${cloudinaryUrl(url, { width, height, crop: "fill" })} ${width}w`)
    .join(", ");
}
