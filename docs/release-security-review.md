# Release review — 19 November 2026

Reviewed workspace: `D:/Codex/tuxarLive-production`.

The existing banner implementation is retained. This release uses saved Supabase
prices and publication status throughout the storefront. No product release
manifests are queued, and the pending migrations do not update product prices.
Do not run the historical catalogue import scripts against production.

## Completed checks

- All 246 security/regression tests passed, including database row ownership,
  staff MFA, disabled accounts, checkout prices, OTP limits, upload validation,
  publication status, and release replay protections.
- All six isolated hosting staging/rollback tests passed.
- Lint, application TypeScript, Edge Function TypeScript and production build passed.
- Generated and verified 1,460 public pages across five languages.
- Compared 1,736 English product cards and 247 English product pages against all
  247 active public database products: zero price mismatches; no remote writes.
- Updated compatible development tooling to remove the reported minimatch advisory.
  A subsequent npm audit reported zero known vulnerabilities.
- Credential scan of working files, both existing Git commits, and 1,537 generated
  build files reported zero findings. Private configuration and generated operator
  output remain ignored and are excluded from the public release artifact.
- Read-only live HEAD checks returned 403 for `.env`, `.git/HEAD`, `.backup.zip`,
  and `.env.example.zip`; security headers were present.

The regression fixtures contain only public catalogue values and public URLs;
they are never part of the deployed website. Generated private operator exports
are no longer required to run these tests from a fresh checkout.

## First deployment gates

The GitHub production setup workflow must verify FTPS credentials, the exact
document root, TLS and protected staging; the Supabase migration baseline; and
the restricted Cloudinary upload permissions. These credentials are stored in
GitHub and were not retrieved locally. Missing migration history must be reviewed
against the actual schema, never marked applied blindly or bypassed by a reset.

Enable the repository variable `DEPLOY_ENABLED=true` only after setup checks pass.
The deployment workflow runs checks before publication, reads current database
prices for prerendering, verifies the live release revision and protected paths,
and restores the previous website if post-publication smoke checks fail.

This is a bounded code, dependency and configuration review, not a guarantee that
the website cannot be attacked. Hosting and live database permissions still need
the deployment preflight checks; frontend rollback does not reverse database migrations.
