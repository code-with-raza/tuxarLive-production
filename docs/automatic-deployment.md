# Push-to-deploy setup for Tuxar

The workflow is `.github/workflows/deploy.yml`. After the one-time setup below,
push/merge to the production branch to run checks, resolve product images, deploy
Supabase migrations and Edge Functions, build public pages and publish cPanel.
Feature branches and pull requests run checks without production secrets or writes.

Production deployment starts disabled. This repository has not been connected to
your hosting account or GitHub secrets by adding these files.

## 1. Find the hosting connection

In cPanel, look for **SSH Access** or **Terminal**. Ask the hosting provider whether
your account supports SSH shell access and Python 3.8 or newer. SSH is the preferred
transport: staging and rollback copies stay outside the website document root.
SFTP access alone without an SSH shell is insufficient for this SSH publisher.

If the account only has file transfer, ask for **explicit FTPS** with a valid TLS
certificate, rename support and MLST support. Plain unencrypted FTP is not used.
The FTPS publisher checks that its staging folder is denied over HTTPS. A
certificate mismatch or publicly accessible staging folder stops deployment.

Get the connection host, port, username and **the document root for tuxar.co.uk**.
For SSH this is an absolute path inside the account's home, for example
`/home/ACCOUNT/public_html`. For FTPS it is the path visible to that FTP account;
it may be `/public_html` or `/` for an account restricted to the document root.
The workflow verifies that the selected folder actually serves tuxar.co.uk using
a temporary harmless marker file, then removes the marker.

For SSH, create a dedicated deployment key and authorize its public key in cPanel.
Store its private key in GitHub. Obtain the host-key fingerprint from the hosting
provider and verify the corresponding known-hosts record independently. Do not
blindly trust a key returned by an unauthenticated scan. Use a passphrase-free
dedicated deployment key with the minimum hosting permissions needed.

## 2. Configure GitHub once

Repository **Settings → Secrets and variables → Actions → Variables**:

| Repository variable | Value |
| --- | --- |
| `PRODUCTION_BRANCH` | Your production branch, normally `main` |
| `DEPLOY_ENABLED` | Keep `false` during setup; set `true` after the baseline and credentials are ready |

Repository **Settings → Environments → New environment → `production`**:

Limit deployment branches to the production branch. Protect that branch with pull
requests and the **Code, security and deployment tests** check. Add required
reviewers if you want an approval on every release; omit required reviewers if you
want automatic deployment after a successful push. Availability of environment
protection features depends on your GitHub plan/repository visibility.

Add these **environment variables**:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Existing production project's HTTPS URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing publishable key or legacy **anon** key |
| `SUPABASE_PROJECT_REF` | Existing production project reference; must match the URL and database connection |
| `CLOUDINARY_CLOUD_NAME` | Existing Cloudinary cloud name |
| `CLOUDINARY_FOLDER_MODE` | `dynamic` (default) or `fixed`, matching the existing Cloudinary environment |
| `DEPLOY_TRANSPORT` | `ssh` or `ftps` |
| `HOSTING_DOCUMENT_ROOT` | Verified path from step 1 |
| `HOSTING_PORT` | SSH port, normally `22`, or explicit FTPS port, normally `21` |
| `VITE_STRIPE_ENABLED` | Required: explicitly match the currently approved payment configuration, `true` or `false` |
| `VITE_GA_MEASUREMENT_ID` | Existing GA4 measurement ID, if used |

Add these **environment secrets**:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase account/deployment token with access to the existing project |
| `SUPABASE_DB_URL` | Existing production direct or **session-pooler** Postgres connection URL, including password, from Supabase's Connect dialog |
| `CLOUDINARY_API_KEY` | Cloudinary upload API key |
| `CLOUDINARY_API_SECRET` | Cloudinary upload signing secret |
| `HOSTING_HOST` | Hosting connection hostname matching its TLS/SSH identity |
| `HOSTING_USER` | Dedicated hosting deployment account |
| `HOSTING_SSH_PRIVATE_KEY` | SSH mode only: full deployment private key |
| `HOSTING_SSH_KNOWN_HOSTS` | SSH mode only: independently verified OpenSSH known-hosts record; use `[host]:port` for a nonstandard port |
| `HOSTING_PASSWORD` | FTPS mode only: FTP account password |
| `SUPABASE_FUNCTION_SECRETS` | Optional JSON object of **explicit server secret updates**, described below |

Do not paste secrets in a chat, source file or `VITE_` variable. The browser only
receives the allowlisted public Vite settings. The workflow scopes private keys
to the upload, database or hosting step that needs them. Its uploaded artifact
contains only verified public website files, including `.htaccess`.

The database URL must use the matching `db.PROJECT_REF.supabase.co` host or a
Supabase session-pooler host with username `postgres.PROJECT_REF`. Use the session
pooler when the runner has no IPv6 connectivity to the direct database endpoint.
Database connections require TLS; configure `sslmode=verify-full` and the correct
CA where supported by your Supabase connection. Do not use the transaction pooler
for migration/session-lock operations.

Resend, Stripe, OTP and Cloudinary secrets already configured in Supabase remain
there. Deploying functions does not reset them. To change them through CI, set
`SUPABASE_FUNCTION_SECRETS` to a JSON object of only the names being updated. The
allowed names are listed in `scripts/ci/backend.mjs`. This is optional; an omitted
secret is preserved. OAuth provider settings, DNS and domain verification remain
one-time service configuration, rather than something reset on each code push.

## 3. Run the setup check before enabling deployment

Open **Actions → Production setup check → Run workflow**, select `main`, and
leave the one-time folder-configuration checkbox unchecked for the first run.
This workflow works while `DEPLOY_ENABLED` is false/unset. Its three independent
jobs check hosting, database history, and the restricted Cloudinary upload key.
It never publishes a website, applies migrations, deploys functions, or changes
products, inventory, payments, or customer records. The database connection is
forced read-only. Hosting checks create temporary/protected diagnostic files;
Cloudinary keeps one tiny reusable diagnostic image in `tuxar/ci` without
overwriting any asset. These checks share the main deployment concurrency lock.

If the Cloudinary key has the **Media Library User** role but no folder access,
configure folder access once. Cloudinary assigns API-key folder roles through
its Admin API, rather than the normal folder-sharing UI:

1. Keep `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` set to the restricted key.
2. Temporarily add the existing administrator key and its matching secret as
   **Production environment secrets** `CLOUDINARY_SETUP_API_KEY` and
   `CLOUDINARY_SETUP_API_SECRET`. Never put these values in source or chat.
3. Run **Production setup check** on `main`, this time checking the one-time
   folder-configuration option. The helper checks folder mode, creates `tuxar/ci`
   if needed, grants that key the **Contributor** role on that folder only, and
   tests a signed upload with the restricted key. It neither upgrades its global
   role nor deletes/moves/replaces assets. If it reports fixed folder mode, set
   the `CLOUDINARY_FOLDER_MODE` variable to `fixed` and rerun.
4. Remove both `CLOUDINARY_SETUP_*` secrets immediately after successful setup.
   Keep the original administrator key active if the live site uses it.
5. Rerun with the checkbox unchecked to verify the ordinary deployment credentials.

The normal production workflow does not receive the temporary setup credentials.
It checks upload access even when no product-image changes are pending.

References: [Cloudinary folder roles](https://cloudinary.com/documentation/admin_api#folder_operations)
and [folder modes](https://cloudinary.com/documentation/folder_modes).

## 4. Align the existing Supabase migration history once

This project has previously shipped SQL files for manual SQL Editor execution.
The workflow therefore verifies that all repository migrations through
`202610310001` are already recorded as applied and that production has no migration
versions missing from Git. It stops before applying anything if this check fails.
It will then apply pending migrations, including the homepage banner table and
the private deployment ledger.

With the existing Supabase project selected, inspect:

```sh
npx --yes supabase@2.121.0 migration list --db-url "$SUPABASE_DB_URL"
```

Compare the remote schema and the effects of each migration against the SQL in
`supabase/migrations`. Only after confirming that an unrecorded migration was
actually applied, reconcile its history using Supabase's documented migration
repair workflow. Do not mark missing work as applied, automatically repair all
versions, run `db reset`, or rerun old catalogue seed/import SQL against production.
If a migration truly is missing, prepare and rehearse the needed upgrade first.
The pipeline deliberately does not guess that the production baseline is correct.

Keep future schema/data changes in new migration files. Never edit an already
applied migration. Production upgrades must remain compatible with the previous
frontend until the new website is published.

## 5. Add or update product images with one commit

1. Put the original new images in `deployment/media/`. Keep the committed files
   below GitHub's size limits; the uploader allows JPEG, PNG, WebP and AVIF up to
   10 MB each.
2. Copy `deployment/product-images.example.json` into `deployment/catalogue/`,
   give it a unique `YYYYMMDD-NNN-description.json` filename and set `id` to that name
   without `.json`.
3. Set the existing product's `slug` and list the image paths with alternative text.
   `images` is the complete replacement gallery; the first image is the card/cover.
   An existing Cloudinary HTTPS URL can be used as `source` instead of a local path.
4. Commit and push the images and release JSON together.

The pipeline uploads local files to immutable content-addressed Cloudinary IDs,
captures their real HTTPS URLs, inserts the product image rows in Supabase, adds
them to the admin media library and generates the storefront gallery mapping.
The same resolved URLs appear on collection cards and product pages. You do not
copy returned URLs between services manually. `overwrite=false` prevents a retry
from replacing an existing Cloudinary object. Failed uploads stop publication.
Existing URLs are checked for a successful public image response before linking.
Public gallery reads also use the saved Supabase images, so subsequent admin image
changes survive the next build instead of reverting to an older source gallery.

Keep applied release JSON and its referenced image bytes immutable. For a later
replacement, add a new release and a new image filename. Editing or deleting an
applied release stops deployment. This preserves history and avoids replaying old
prices/status over changes made through the admin panel.
New IDs must sort after already applied releases. Use an increasing three-digit
counter for releases on the same day, such as `001`, `002` and `003`.

To change a product's price or status explicitly through Git, add a new release:

```json
{
  "id": "20261117-002-jacket-price",
  "products": [
    {
      "slug": "classic-zip-quilted",
      "fields": {
        "pricePence": 13900,
        "comparePricePence": 18900,
        "status": "active"
      }
    }
  ]
}
```

Prices use integer GBP pence. Set `comparePricePence` to `null` to remove a previous
price. Price changes update variant prices that matched the old global price;
custom variant price overrides remain intact. No existing stock is reset. New
releases apply once in a database transaction; later ordinary pushes leave those
rows unchanged. Admin edits therefore continue to work normally.

Optional `collections` explicitly replaces that product's collection memberships.
Other allowed `fields` are `name`, `tagline`, `description`, `category`, `material`,
`weight`, `origin`, `badge`, `seoTitle`, and `seoDescription`. Translation files
remain the place for translated copy; changing English copy does not invent
translations or new categories. Category/page layout code and migrations can be
committed with the release as needed.

Existing translation entries, including English, take precedence over catalogue
copy. When changing text for an existing product, update its matching entry in
`src/i18n/locales/en.json` and any affected language files in the same commit.
The pipeline deploys those edits together with the database change.

### Adding a brand-new product

A release can include a `create` object containing the storefront `Product` fields
from `src/data/product-types.ts`, except `image` and `gallery` (supplied by `images`).
Supply an explicit `audience`, sizes, colours, price, description, specifications
and initial `variants` with SKU, size, colour, colour hex and stock. See
`deployment/new-product.example.json` for a complete template. The database product
starts as a draft unless `fields.status` explicitly publishes it. The generated
frontend and sitemap include it; public status checks keep drafts hidden.

Existing product variants/stock cannot be reset through this file format. Use the
admin inventory controls for normal stock changes. A structural variant change
needs a separate reviewed migration so sold stock and order references survive.

The generated `src/data/products/deployment-catalogue.json` starts empty in Git.
CI reconstructs it from release history; do not edit it manually or commit a
Cloudinary dry-run placeholder as a real upload URL. Original approved catalogues
and unapproved local preview imports are not automatically seeded/published.

## What happens on a production push

1. Install locked dependencies, run lint, TypeScript, security and publisher tests.
2. Validate release files, compile an offline bundle and scan for credentials.
3. Confirm this is the newest commit on the configured production branch.
4. Verify hosting access/document root and the existing Supabase migration history.
5. Upload referenced images, compile the resolved website, then apply pending
   migrations, deploy Edge Functions and apply new catalogue releases once.
6. Generate all public pages with current live prices/status and scan the final
   public files. Retain the exact public artifact in GitHub for 14 days.
7. Upload assets, replace the complete generated page directories, then publish
   the root index last. This removes stale pages for hidden/archived products.
8. Check the deployed commit, all five homepages, JavaScript and sitemap. If these
   checks fail, restore the previous website automatically.

Deployments are serialized and not canceled halfway through writes. A retry uses a
new GitHub run attempt, reuses immutable Cloudinary images and skips applied product
releases. New image uploads left by a failed later step are harmless and are not
automatically deleted. Private website backup copies are retained on hosting;
monitor quota and remove old backups deliberately once a release is confirmed.

Website rollback does **not** undo database migrations, function deployments,
orders, payments or product changes. Cross-service deployment is not one atomic
transaction. Use backward-compatible migrations and corrective forward releases;
do not automatically reverse production data or reset inventory after an error.
DNS/CDN cache configuration may need a one-time adjustment if it caches HTML or
`deployment.json` so aggressively that the new release cannot be verified.

## Validate locally

```sh
node scripts/ci/catalogue.mjs
node --test tests/security/ci-pipeline.test.mjs
python3 -m unittest discover -s tests/ci -p 'test_*.py' -v
npm run typecheck
npm run lint
```

The first command validates paths, image signatures and changes without uploads
or database writes. `--upload --write-frontend` is reserved for the production
workflow with Cloudinary credentials. Before enabling `DEPLOY_ENABLED`, finish
steps 1–3 and confirm the current public payment settings. Then push/merge the
workflow and completed changes to the configured production branch. Open GitHub's
Actions tab to inspect each release; a failed check stops subsequent steps.

Official references: [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
[Supabase environments and migrations](https://supabase.com/docs/guides/deployment/managing-environments),
[Supabase function deployment](https://supabase.com/docs/guides/functions/deploy),
[Cloudinary uploads](https://cloudinary.com/documentation/upload_images),
[cPanel SSH access](https://docs.cpanel.net/cpanel/security/ssh-access/).
