# Post-migration 42501 — actual read-only diagnosis

Verified 2026-11-02 (Dubai): https://github.com/dubai717/ab-group-demo/actions/runs/41396579416

- All eight approved migration ledger entries and checksums match. All 23 expected application tables exist, with 46 validated foreign keys.
- Runtime LOGIN/schema/company/bank privileges, RLS flags, original constraints/triggers, append-only protections, public function restrictions and browser-schema restrictions passed catalog checks.
- Exact failing statement: `SET LOCAL ROLE ab_runtime`. The inspection connection/current role is `postgres`, and `pg_has_role(session_user,'ab_runtime','SET')` is false. Required permission is SET-role membership on `ab_runtime`, not a missing privilege on a company/bank table or schema.
- Fixed the inspection tool by explicitly separating catalog validation from role impersonation. Corrected catalog-only mode passes without any GRANT or RLS change; it explicitly reports runtime RLS execution as pending. The default runtime-execution check remains strict.
- No migrations were reapplied during diagnosis; no schema/privilege/data changes, deletes, merges or website publication occurred.

Before real ERP API/UI trials, use a dedicated protected runtime connection authenticated as the existing `ab_runtime` role rather than granting the administrative inspection account extra role-switch rights. Provisioning that role's password is outside the eight approved SQL files and requires separate owner approval; no password or privilege change was performed. The owner must then supply DATABASE_URL through the protected GitHub Environment. A persistent DATA_ENCRYPTION_KEY is also required before retaining encrypted trial records. No ERP login/company/bank trial is claimed completed by catalog inspection.
