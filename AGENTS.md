# Working preferences

- Read `docs/PROJECT_MAP.md` first; inspect only files relevant to the current request.
- Keep tool output and user updates concise. Batch independent reads; avoid dumping large catalogue, translation or generated files.
- Preserve current database prices, discounts, stock, customer orders and publication decisions. Never replay historical seed/import migrations.
- Finish the requested batch and required checks before deploying. Do not push partial work merely to run CI.
- Never print or commit private credentials, customer exports or ignored `output/` diagnostics.
- Run security test files serially: they currently share generated fixtures (`npm run test:security`).
- `tuxarLive-production` is the production checkout. Sync final changed app files to `D:/Codex/tuxar-luxury-launch` only after checking for conflicting edits there.
- Report local, deployed and live-verified status separately. Do not claim a browser or translation-provider check that was not performed.
