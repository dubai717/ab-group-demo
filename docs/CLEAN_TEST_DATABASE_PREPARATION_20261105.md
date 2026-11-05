# Clean Supabase test project preparation — 2026-11-05

## Boundaries

This kit creates schema only in an empty destination. It does not create a Supabase project, import accounts or source data, configure a bucket, change secrets, deploy, or switch Render. The old project and encrypted backups remain intact.

Cloud management access and the organization's actual Free quota are unavailable to this execution environment. New project creation and its $0 pricing must be confirmed in the owner's Supabase dashboard. Do not upgrade, delete, or pause the old project to make room without further approval.

## Prepared kit

- `backend/clean-test/build.py` validates all 13 exact source checksums against the existing approved catalogs and emits `clean-schema.sql` and `manifest.json` into the requested local output directory.
- Example for an authorized operator: `python3 backend/clean-test/build.py /tmp/ab-clean-kit`.
- SQL contains the original migrations in order and a checksum ledger, in one transaction. It refuses an existing AB schema, runtime/scanner role, public user table, Auth user, or storage object before DDL. Do not weaken this guard to run against the old project.
- No project identifiers, connections, secrets, passwords, source exports, Auth records, or business fixture rows are bundled.
- The migrations create global role/permission references; organization/Owner/bootstrap/reference setup remains a separate reviewed step. Schema success alone does not make the application ready for a Render switch.
- The runtime role created by the approved foundation has LOGIN but no password; the kit does not assign credentials. Existing restrictive role flags and RLS are preserved. Connection preparation is a later separately approved step.
- `.github/workflows/clean-test-schema-kit.yml` runs only on its dedicated verification branch. No Environment, secrets, deploy hook, or cloud database connection is supplied. It uses an ephemeral PostgreSQL 17 container and removes that container only.

## Transfer whitelist — proposed, NOT executed

| Category | Required decision / treatment |
|---|---|
| Original Owner and ten managed test users | Preserve application IDs, tenant IDs, approved role/status/profile mappings. No account recreation, password reset or Auth ID reassignment in this task. |
| Supabase Auth | Validate Supabase-supported user/identity/password-verifier migration in isolation before proposing an import. Do not directly copy Auth tables, passwords, sessions, refresh tokens, JWT secrets or encryption keys. No password portability is claimed. |
| Roles, permissions and invariants | Use exact migration definitions. Preserve any necessary reviewed overrides and delegation scopes, without elevation. |
| Ten existing company memberships | Reference an old test-suite company. Zero-old-company target cannot preserve those foreign keys as-is. Requires explicit mapping to a new approved reference company, or an approved revised scope; do not silently discard or widen. |
| Chart of accounts | Latest read-only inventory found 14 definitions, all tagged with old TEST_DATA provenance, plus 42 company bindings and seven bank bindings. Review reusable definitions as templates only. Do not import old company/bank relationships into an empty business database. |
| Reference configuration | Review emirates/areas, approved bank/purpose catalogs, document expiry rules, and required neutral settings. No blanket settings copy: sealed TEST_DATA/test-user registries contain project-specific data and need explicit safe reconfiguration. |
| Private attachments | New private bucket and restrictive access policies must be prepared/verified separately. No old TEST_DATA files or references are imported. |
| Original audit history/backups | Retain in old project and encrypted archive; do not rewrite history or import fake transaction history into new operational tables. |

## Exclusions

Exclude all old TEST_DATA business rows and exclusive children, including five companies, seven banks, 30 customers, 50 vehicles, 12 financings, 342 invoices, 28 receipts, 35 tasks and 386 alerts, plus related journals, allocations, schedules, links, files and company-specific settings. Previous preview identified 3,755 scoped rows and 95 documents. This kit does not read or copy any of them. Do not interpret those preview counts as deletion counts: nothing was deleted.

Do not import unrelated source business rows either. Importing users/settings requires the whitelist and dependency mapping above, rather than restoring the old full backup into the new target.

## Existing recovery evidence

Previous read-only workflow `42013514646` successfully restored the retained encrypted archive into isolated PostgreSQL 17, verified 96 archived documents and database structure/RLS. Archive remains under private bucket `ab-private-test` at:

`ab-group-backups/v1/20261105T100805359Z-904cef09-e839-4e8f-996d-63adc31226f6/database.abbackup`

Its companion `metadata.abmeta` remains required. This preparation does not replace the archive, rotate keys, or rerun a redundant source backup.

## Necessary owner action now

1. In Supabase, select a Free organization and create `ab-group-erp-clean-test` in the old project's region only if the creation summary is $0 and no paid upgrade is required. If quota is full, stop and report it; preserve the old project.
2. Generate a new database password and retain it in a private secrets manager. Do not send it in chat or alter the current GitHub/Render secrets.
3. Once Healthy, provide only the Project Ref and region. Project existence, Free quota, real Supabase schema application, Auth and private storage checks remain unverified until this action is completed and secure target access or SQL Editor execution is arranged.

## Subsequent cutover, not authorized by this preparation

Confirm new target identity; apply guarded kit there using an approved secure mechanism; review account/Auth and membership mappings; set up new project-specific protected secrets and bucket; test real Auth/RLS/storage without reseeding business fixtures; verify clean counts; take a new encrypted backup and restore drill. Then obtain explicit approval to change Render/GitHub target secrets and project guards, deploy staging and verify Owner, test users, original forms and persistence. Keep old project/backup for rollback. No changes to those connections or guards occur now.

## Test results

See the dedicated verification workflow run linked in the final delivery. Local generation validated all 13 approved hashes; TypeScript project compilation passed. Isolated tests are distinct from real Supabase acceptance; no real new cloud project, Auth login, bucket or Render cutover is claimed tested by this kit.

Verified run: https://github.com/dubai717/ab-group-demo/actions/runs/42017537088 (success). All 13 migrations/ledger hashes, empty non-reference tables, expected RLS policies, validated constraints, restrictive runtime flags, rejection of repeated application, company create/retrieve and cross-tenant denial passed in disposable PostgreSQL. Synthetic test rows were rolled back; no cloud connection was made.
