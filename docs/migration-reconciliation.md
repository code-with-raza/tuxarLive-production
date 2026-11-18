# Existing production migration history

The owner-provided metadata audits confirmed the October security, COD-disable
and GBP/EUR schema changes are installed, but four migration versions are absent
from the Supabase ledger:

- `202610170001`
- `202610170002`
- `202610260001`
- `202610310001`

The 193 missing named NOT NULL constraints in the first audit were PostgreSQL
18 versus PostgreSQL 17 catalogue differences; column nullability matched.
The MFA helper's returned definition differed only in whitespace. The remaining
function differences were direct role grants inherited from Supabase defaults.
Existing service-role permissions are retained. The additive permission migration
removes anonymous execution from four staff RPCs and sets explicit browser-access
defaults for future functions. The local database harness now reproduces the
Supabase default function grants so this behavior is covered by regression tests.

A one-time, owner-specific reconciliation was prepared outside the repository at
`D:/Codex/Reconcile-production-migration-history.sql`. It checks 541 baseline
metadata facts with only the reviewed differences allowed, applies the targeted
permission changes, verifies the result, then inserts only the four missing
baseline versions. Unknown migrations or unexpected schema differences abort the
transaction. Historical migrations, seed scripts and product imports are not run.

Local PostgreSQL tests reproduced the audited state, verified the resulting
permissions, preserved prices/status/stock byte-for-byte, verified rerun behavior,
and confirmed unexpected RLS drift blocks reconciliation. This preparation is not
evidence that production reconciliation has been executed successfully.

The permission migration remains pending in normal deployment history and can
run again safely after the manual reconciliation. Do not record later pending
migrations prematurely, bypass preflight, reset the database, or publish a live
schema dump or customer export into this repository.
