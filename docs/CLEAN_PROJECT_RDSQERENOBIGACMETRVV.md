# Clean project handoff: rdsqerenobigacmetrvv

Owner reports project `ab-group-erp-clean-test`, Healthy, Free, Singapore. The executor has no new-project credentials or Supabase management access. Its existence, account plan and cloud state are owner-attested, not independently API-verified. No cloud SQL has been executed by this preparation.

## One manual action, without new secrets

Open https://supabase.com/dashboard/project/rdsqerenobigacmetrvv/sql/new and confirm the displayed project is `ab-group-erp-clean-test`. Download the schema-only artifact from the linked verification run. Open `ab-group-clean-rdsqerenobigacmetrvv.sql` in a text editor, paste the complete contents into SQL Editor and run as the project's postgres administrator. Do not use the old project's SQL Editor. A SQL session does not reliably expose a Supabase Project Ref; the artifact's named target is an operator instruction, not a cryptographic destination binding.

The file applies the exact 001–013 source migrations and ledger in one transaction, verifies all expected tables, enabled RLS/policies, validated constraints, restrictive runtime flags, and empty non-reference tables BEFORE commit. It imports no accounts, credentials, documents or business rows. It refuses a nonempty AB/public/Auth/storage destination before schema changes. If any error occurs, report the error only; do not weaken guards, rerun individual migrations or change permissions. Expected result: `CLEAN_SCHEMA_13_APPLIED_AND_VERIFIED`, migrations `13`. Send that non-sensitive result back; no passwords, SQL connection URLs or keys are needed.

## Transfer whitelist still pending review

Original Owner plus ten managed test users; approved roles/actions/delegation boundaries; neutral reference settings and geographic catalog; reviewed reusable account-chart templates. No transfer has occurred. Supported Auth identity/password-verifier migration must be validated before preserving existing login credentials: no direct auth table copying, resets, changed auth IDs, JWT/session tokens or encryption-key copying is authorized here.

Ten existing company memberships refer to the previous reference company; zero-company destination needs explicit approved scope mapping. Fourteen chart definitions were old TEST_DATA-tagged; 42 company and seven bank bindings cannot be copied with their old business references. Preserve old database unchanged while reviewing templates and mappings. Do not silently widen permissions or create replacement business fixtures.

Exclude every old TEST_DATA company, bank, customer, vehicle, financing, invoice, receipt, journal, task, alert, attachment and exclusive child. Do not restore the old full backup into the new database.

## Readiness and later cutover

Schema-only SQL does not initialize organizations/accounts, Auth, a private bucket, runtime password, provider keys or encryption configuration. Real cloud Auth/storage/backend tests and approved account setup remain required before cutover. Existing isolated PostgreSQL schema checks do not count as a real Supabase connection test.

Old database, encrypted backup, Render URL/connection, GitHub secrets, application behavior and permissions remain unchanged. No main merge, staging deployment or source migration is performed. After cloud verification and reviewed account/scope setup, obtain separate approval for new protected target credentials/project guards and the Render switch, preserving the old project for rollback.
