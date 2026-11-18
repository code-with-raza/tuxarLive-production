# Homepage banner management

The Banners section lists both original and added banners. Add banner and Edit
open a dedicated, staff/MFA-protected page at `/{locale}/admin/banners/{id}`.
New banners start as drafts. The editor includes image upload/URL selection,
title, accessible description, click destination, order, optional text overlay,
and publication status. Move to draft hides a published banner; Publish restores
a complete draft. Delete asks for confirmation and removes the banner from the
slideshow while retaining its uploaded image.

## One-time database update

Apply `supabase/migrations/202611180001_manage_homepage_banners.sql` after the
existing homepage-slides migration. The prepared `D:/Codex/Manage-all-homepage-banners.sql`
includes both updates for manual SQL Editor installations.

The update registers five original banners per language, retaining their existing
image URLs, wording and destinations. It places existing added banners after the
originals. Unique import keys make reruns preserve later edits, drafts, deletions
and ordering. It does not modify product prices, inventory, customer data, media
files or Cloudinary credentials.

The public homepage and its build-time image preload use only published,
non-deleted records from Supabase. There is no hardcoded fallback that could
resurrect a drafted or deleted banner. If every banner is hidden/deleted, the
homepage omits the carousel. Install the database update before publishing the
new website build. GitHub automatic deployment applies the migration before
prerendering public pages.

The new public reader `homepage_published_slides` returns only published records.
Ordinary anonymous table reads keep returning added banners, so older deployed
carousels do not append a duplicate copy of their five built-in banners during
the transition. Staff can still manage all records through the existing MFA/RLS
rules. The reader does not expose drafts or deleted banners.
