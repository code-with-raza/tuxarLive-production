import { cloudinaryUrl } from "./cloudinary";

export type HomepageBannerRow = {
  locale: string;
  enabled: boolean;
  image_url: string;
  destination_url: string;
  title: string;
  alt_text: string;
  button_label: string;
  image_width: number;
  image_height: number;
};

export function validBannerImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/[\s\\]/.test(value);
  } catch {
    return false;
  }
}

export function validBannerDestination(value: string) {
  if (!value || /[\s\\]/.test(value)) return false;
  return (value.startsWith("/") && !value.startsWith("//")) || validBannerImageUrl(value);
}

export function homepageBannerFromRow(row: HomepageBannerRow | null, locale: string) {
  if (
    !row?.enabled ||
    row.locale !== locale ||
    !validBannerImageUrl(row.image_url) ||
    !validBannerDestination(row.destination_url) ||
    !row.title.trim() ||
    !row.alt_text.trim()
  )
    return null;
  if (!(row.image_width > 0 && row.image_height > 0)) return null;
  return {
    image: row.image_url,
    href: row.destination_url,
    title: row.title,
    alt: row.alt_text,
    cta: row.button_label,
    width: row.image_width,
    height: row.image_height,
  };
}

export function campaignImageSources(image: string) {
  if (!image.startsWith("https://res.cloudinary.com/")) return undefined;
  return [480, 960, 1280, 1920, 2172]
    .map((width) => `${cloudinaryUrl(image, { width, crop: "fit" })} ${width}w`)
    .join(", ");
}
