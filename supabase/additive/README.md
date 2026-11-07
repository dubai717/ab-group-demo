# Safe automatic staging additions

Only sequential `014_name.json`, `015_name.json`, … files using `AB-SAFE-ADDITIVE-1` are automatic. Operations are limited to nullable `custom_` columns (text/boolean/date/timestamptz/uuid, no defaults or constraints) and nonunique simple indexes on the existing allowlisted business tables. No raw SQL, existing column updates/removals, function/trigger/RLS/grant changes, role/user tables or financial posting-table changes are accepted.

Every release validates immutable SQL migrations 001–013 and already applied JSON hashes, captures and restores a fresh encrypted backup, rehearses pending additions on its local clone, and checks preservation before committing the same generated SQL to the pinned test project. An unknown ledger, source change since backup, invalid JSON, conflict or failing comparison stops deployment. No destructive down migrations or automatic record cleanup occur.

Example (do not add it as a migration until actually required):

    {"format":"AB-SAFE-ADDITIVE-1","operations":[{"kind":"addNullableColumn","table":"companies","column":"custom_label","type":"text"}]}

Complex migrations and changes to financial logic or permissions require explicit owner approval and a separately reviewed migration plan. This is intentionally a safe subset, not a classifier that declares arbitrary SQL harmless.

## Business centers SQL proposal (014–025)

The SQL files in this development branch are **not** `AB-SAFE-ADDITIVE-1` inputs and are not approved for automatic application by this README. They include new scoped permissions, triggers and financial-party invariants. They were exercised only on fresh synthetic databases. The trusted v2 controller intentionally stops at `ADDITIVE_CONTROLLER_REVIEW_REQUIRED`; do not bypass it or run these files manually against the hosted database. See `docs/implementation/business-centers-7-14.md` for review order, release prerequisites and rollback boundaries. Existing approved 001–013 files remain unchanged.
