import { homepageBannerFromRow, type HomepageBannerRow } from "./homepage-campaign";

export const HOMEPAGE_SLIDE_INTERVAL_MS = 3000;

export type HomepageSlideRow = HomepageBannerRow & {
  id: string;
  position: number;
  archived: boolean;
  eyebrow: string;
  subtitle: string;
  show_text: boolean;
  tone: "light" | "dark";
};

export function publishedHomepageSlides(rows: HomepageSlideRow[], locale: string): HomepageSlideRow[] {
  return rows.filter(row => !row.archived && homepageBannerFromRow(row,locale))
    .sort((a,b) => a.position-b.position || a.id.localeCompare(b.id));
}

export function homepageSlidesError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "PGRST205" || error?.code === "42P01")
    return "The slideshow database update has not been installed yet. Your existing homepage slides are still shown. Apply the homepage slides update, then select Retry.";
  if (error?.code === "42501" || error?.code === "PGRST301")
    return "Your sign-in could not access the slideshow. Sign in with a staff account and try again.";
  return "Could not load slideshow settings. Your existing homepage slides are still shown. Please try again.";
}
