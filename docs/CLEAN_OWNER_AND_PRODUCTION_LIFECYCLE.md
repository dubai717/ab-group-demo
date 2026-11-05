# Owner-only clean staging and future production lifecycle

## Current approved target and scope

Supabase project `ab-group-erp-clean-test`, ref `rdsqerenobigacmetryv`, Singapore, Free as reported by the owner. Preserve old `ab-group-erp-test`, all its accounts/data/backups and current Render connection. No new paid resources, production deployment or connection changes are authorized. This plan supersedes earlier proposals to transfer the ten managed test users or old Owner credentials: **no old account, password, auth_id, business row, encrypted registry or document is imported**.

Approved schema 001–013 is packaged by `release.py`, with exact source checksum validation, an empty-project preflight, one transaction and precommit schema/RLS/constraint/empty-data checks. If already applied, do not rerun or bypass its nonempty guard; first read the ledger and validate existing hashes. Source migrations remain unchanged.

## Owner-only initialization

`owner-kit.mjs` generates `owner-only.sql`. It creates no Auth account and never reads or handles password/verifier/token material. In the NEW project's Authentication → Users dashboard, an authorized owner creates exactly one email/password account using a fresh strong password retained in a password manager. Confirm the email using the supported Supabase flow or explicit administrator confirmation. Do not recreate the old trial account or import its password. No email/password is requested in chat.

After schema verification, the operator verifies the new project URL and Auth identity in the dashboard, then runs the generated SQL there. It binds the sole confirmed, undeleted, unbanned Auth identity to application username **owner**, role **owner**, status Active, using the unmodified approved role catalog. A transaction-level advisory lock and checks for existing organization/user, plus existing unique owner/Auth/username constraints, prevent duplicate initialization. More than one Auth identity, unconfirmed identity or a prior application Owner aborts; nothing is automatically deleted or reset. This initial empty-project procedure is not an account-recovery/reset tool.

Only organization/profile, existing geographic references, account-purpose references and an initialization audit event are inserted. No demo bank reference, company, bank account, customer, vehicle, financing, invoice, task, managed-test registry or additional user is generated. Bank names and companies can later be added through the normal authorized screens. No extra grants, RLS changes, role changes or disabled financial guards are needed.

Real Supabase Auth login and server authorization remain acceptance gates: a local Auth metadata mock does not prove an actual login. Before switching Render, test approved server-side user creation, role assignment, activation, new-account login and denial of unauthorized Owner/financial/cross-company changes, using an isolated acceptance database. Do not persist generated acceptance users/business fixtures into the new clean target. The owner manually creates future trial accounts using original screens.

## Manual boundary now

No secure new-target connection exists in the current execution environment. Do not reuse the old GitHub secrets. Use the new project's SQL Editor (https://supabase.com/dashboard/project/rdsqerenobigacmetryv/sql/new) for the tested schema-only file and return its non-sensitive result. No secrets or Render changes are required for that step. The SQL session does not reliably expose a Supabase project ref; the operator must verify the dashboard target. Account creation and the owner-only SQL are a subsequent controlled step, after schema result confirmation.

## Render cutover gates — not executed

1. Verify new schema ledger/current counts and owner identity; private bucket/access policies; TLS and `ab_runtime` authentication with NOBYPASSRLS, no administrative connection in web process.
2. Prepare **separate** protected target credentials and new encryption key through an approved secrets mechanism. Never copy passwords or reuse old sealed registries. Keep old encrypted backup key separately for old recovery. Request explicit approval before changing GitHub/Render secrets, project allowlist hashes or connection.
3. Review project-pinned Test Users/Test Data endpoints and release guards. They must not seed users/data, bypass pinning or require the old test manifest on the new target. Retain approved original user-management functionality. Existing smoke/seed routines must not run persistently against the clean target.
4. Run actual Auth/RLS/storage/backend acceptance against the correctly pinned target; initialize no synthetic business pack. Review whether the currently deployed frontend/server supports every required workflow with the new empty reference state.
5. Take encrypted backups and perform isolated restore drills for old target (rollback) and newly prepared target. Verify hashes, ledger, tables/constraints/RLS/row counts and protected object hashes. Retain immutable backup versions and secure key recovery separately.
6. Obtain explicit approval for a staging-only connection switch/deployment at the same Render URL. Pause writes during the switch; record code SHA, migration ledger and target identity without secrets. Test Owner login and manual company/customer/vehicle creation/reopen in original screens. Keep those manually entered rows. No old business records are imported.
7. If acceptance fails, stop writes and revert code and the connection to the old known-good configuration; do not restore the old dump over the new database, delete new entries or roll back schema destructively. Reconcile any entries created during the cutover window explicitly.

## Permanent development data-retention policy

Every row manually entered during development is test data but **must persist across releases**. Test status is not deletion consent. Deployments must never reset/reseed/replace/restore over staging, run TRUNCATE, delete fixtures by names, clear tables, recreate databases or auto-provision test accounts. Existing TEST_DATA cleanup and sample seeding tools remain manual, restricted tools and must not be called by the new-target deployment path.

For each change: preserve code in Git/PRs and immutable release SHAs; append versioned forward migrations (never edit applied files); verify ledger checksums; test migrations on an isolated restored clone; compare pre/post counts and financial totals; reject data loss, permission broadening or invariant changes without independent approval. New additive nullable columns/reference changes must preserve old rows. Stage backfills in reviewed transactions. Use expand/contract for incompatible changes and never drop historical columns automatically. Backup/restore proof and passing tests gate deployment; destructive/financial/permission changes stop for approval. Retain release notes/test evidence and last working code image/SHA. Application rollback must remain compatible with migrated schema.

## Future production option 1: reviewed trial-data cleanup

Assess actual registered row provenance, external/shared relationships and immutable history on a restored isolated clone first. Use only existing supported deletion procedures; no trigger/RLS bypass, forced deletes, TRUNCATE CASCADE or accounting manipulation. Reversal/voiding retains history and does not equal a clean production database. If any retained trial transaction is immutable (as in the old TEST_DATA group), this option cannot yield full removal under current protections. Stop and select option 2; never promise automatic cleanup or introduce a production purge bypass.

## Future production option 2: new clean production database

Use the **latest accepted complete migration chain**, not a frozen 001–013 export. Generate a new versioned manifest with approved hashes/counts as further migrations are accepted; replay it into a new empty database and verify schema/functions/constraints/RLS. Use a reviewed allowlist of neutral configuration, account-chart templates without balances or old company/bank links, roles and permission definitions. Recreate identity/Owner access through a supported secure provisioning process and explicitly reviewed scopes; do not carry trial identities, sessions or transaction history by default. Exclude all trial business records, journals, tasks, alerts, files and project-bound encrypted settings.

Separate production credentials, private storage, encryption/backup keys and environments from staging. No production automatic publishing without independent approval. Restore-test production backups in isolation; run login/permission/data-save/storage acceptance using rollback-only or disposable acceptance data, not persistent fake production entries. Confirm empty financial balances and no orphan relations. Rehearse a write freeze, backup, explicit production cutover and rollback; retain staging and old backups until independently approved retirement. All application improvements and migrations remain in the same maintained program; no rewrite or repeated feature implementation is needed.

## Current results / limitations

Schema kit verification run 42018326806 passed against isolated PostgreSQL 17. Owner-only kit and duplicate/unconfirmed-identity tests are added in this review branch. Cloud schema application, actual new Owner Auth creation/login, private storage/runtime connection and Render cutover are **not complete** without target execution/access. No claim is made that the new cloud database is ready for Render before these gates pass.
