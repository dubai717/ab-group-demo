# Supabase Free — gated verification runbook

Prepared 2026-11-02 (Asia/Dubai). **Not executed against Supabase.** No project, bucket, Auth account, paid resource, merge or deployment is authorized by this runbook. Current owner approval covers preparation/local verification only.

## Gates before any cloud write

1. The owner approved correction of the six findings. Forward migration 008 now fixes them and all 29 schema checks pass. The seven earlier migrations and original roles remain unchanged. See the execution update in `docs/PHASE1-VERIFICATION-RESULTS.md` and the short owner steps in `docs/SUPABASE-QUICKSTART-OWNER.md`. Cloud project/secret/network setup is the remaining gate; do not repeat the old approval loop.
2. Obtain explicit approval for a named Supabase **Free, test-only** project, region, owner, and private test bucket. Confirm the Free plan and current quotas/billing behavior in the owner's dashboard; do not activate paid upgrades. If an isolated test project already exists, the owner must confirm its identity and synthetic-only contents. Never use production.
3. Supply secrets through the environment's protected secret mechanism, not chat, git or PR descriptions. Required: project URL, legacy anon/service-role keys compatible with this adapter, separate administrator/runtime SQL connections, independently generated data/backup encryption keys and separate scanner credentials when ready. New publishable/secret key formats are not yet validated by this adapter; do not assume compatibility with its Bearer-token use.
4. Approve network access for the **exact** `<project-ref>.supabase.co` HTTPS host and the dashboard-selected database/pooler hostname and TCP port. The current managed environment has no Supabase secrets or allowed Supabase HTTP/TCP destinations. Add them through the environment configuration workflow; do not bypass the proxy or disable TLS verification. Choose a supported direct/session connection for migrations; test pooler/transaction behavior explicitly before using it for the API.
5. Record planned source/restore destinations, migration checksums, baseline role catalogs and rollback/recovery procedures before applying SQL. A new cloud project and a second cloud restore destination each need approval. Do not reset existing databases or modify the integration/main branches.

## Setup checklist after approval (operator-reviewed steps)

- Keep Supabase's exposed API schemas away from `ab`. This application uses the trusted Node API and restricted SQL connection; do not expose `ab` through PostgREST or grant `anon`/`authenticated` access to it. Disable public signup for this synthetic pilot and configure Auth URL/redirect restrictions. Verify actual effective PUBLIC/anon/authenticated/default privileges: local PostgreSQL defaults are not proof of managed-platform defaults.
- Create the approved private bucket with no public access or direct browser write policies. Check anonymous and ordinary-user object reads/writes are denied. The service-role key is server-only and bypasses storage RLS; every operation must still pass the ERP API authorization checks.
- Review/create `ab_runtime` with no owner, superuser, BYPASSRLS, CREATEROLE or CREATEDB rights. Check that an existing same-named role was not overprivileged: the migration intentionally does not silently reconfigure an existing role. Set its password privately without printing it or committing SQL containing it. The scanner is a separate login role granted only the reviewed `ab_scanner` capability; never give that role to the web process.
- Require verified database TLS for migrations, provisioning, scanner and runtime. The current migration/provisioning CLI uses the connection URL's TLS configuration: explicitly set verified TLS there, do not assume the web server's settings apply to those CLIs. Configure a trusted CA if required; never use `rejectUnauthorized:false` or insecure `sslmode`.
- In a reviewed ignored secret file based on `backend/.env.example`, set APP_ENV=staging and the test project configuration. Do not commit this file. Existing commands are **not** project-creation commands:

```sh
node --env-file=backend/.env --import tsx backend/src/migrate.ts
# After one synthetic Auth user exists, set BOOTSTRAP_AUTH_ID/EMAIL/USERNAME/NAME:
node --env-file=backend/.env --import tsx backend/src/provision.ts
```

- The bootstrap creates a NEW organization/owner mapping and reference rows. It must be run once for that subject; do not replay to replace an existing group. Use a synthetic account and a controlled test mailbox, not a real employee identity. Test `email_confirm:true` enrollment does not verify mailbox ownership. Preserve current users/roles; browser-data import remains out of scope and requires a separate mapping/dry-run plan.
- Validate the migration ledger against every versioned SQL SHA256, all same-tenant FKs, RLS flags, role catalogs, narrow SECURITY DEFINER function ownership/search_path, append-only restrictions, owner/cycle protections and the corrections agreed at gate 1.

## Actual-connection preflight (prepared, not executed remotely)

`backend/review/live-preflight.ts` refuses execution before approval/configuration. It creates no project/bucket/user, runs no migrations, makes SQL reads only and exercises actual Auth login/verify/logout for an **already provisioned** synthetic subject. It intentionally creates a temporary provider login session; logging out/revoking it is required. It prints only phase/status results, never credentials/tokens/record contents.

Configure in the protected test environment:

- `AB_LIVE_CHECK_APPROVED=yes` only after explicit cloud-test permission.
- `AB_SYNTHETIC_PROJECT=yes`, `APP_ENV=staging`.
- `AB_EXPECTED_PROJECT_REF`, `AB_EXPECTED_DATABASE_HOST` exactly matching the approved project/connection.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, restricted verified-TLS `DATABASE_URL`.
- `LIVE_TEST_USERNAME`, `LIVE_TEST_PASSWORD`, `LIVE_TEST_AUTH_ID` of the existing synthetic user.

```sh
node --env-file=backend/.env --import tsx backend/review/live-preflight.ts
```

Exit 2 / NOT_RUN means the approval gate is closed, **not** a successful provider test. Exit 1 means configuration/connection/verification failed; inspect private logs without publishing credentials. A PASS here proves actual DB/Auth reads and login only. It does not prove ERP cookies, CRUD, storage, scanner, recovery delivery or cloud restore. A hosted deployment remains separately forbidden; use a separately approved local backend connection to the test services for subsequent tests.

## Full live acceptance matrix — all pending

| Test | Required evidence |
| --- | --- |
| Login | Username/password correct and wrong; same generic error for unknown/incorrect account; real Auth subject matches mapped active user; Secure HttpOnly cookie; invalid/expired/logout/disabled sessions denied. |
| Permission isolation | Owner protected; general manager/department/employee rights exactly match approved catalog/grants; two synthetic groups and multiple companies cannot cross scopes; delegated rights cannot exceed issuer or be re-delegated without authority. |
| Company CRUD | Approved fields including license dates, Salik/traffic/location persist; reload/independent browser sees central data; stale revision rejects without data loss; original browser stores untouched. |
| Banking | Two independent accounts per company, license relation, exact amount/currency, purpose, branch/status/dates and optional relationship-manager fields persist; duplicates and unauthorized company links denied. |
| Files | Company/bank/personal ownership permissions, multiple files/versions/annex links, author/time and old version retention; encrypted bytes in private bucket; unauthorized direct access denied; pending/rejected files cannot download. Configure a real trusted scanner before clean-file download tests. |
| Failures | Provider downtime, SQL failure, upload failure and retry/idempotency; no false save success; document Auth/object orphan reconciliation without deleting earlier records automatically. |
| Audit | All approved successful writes/grants/revocations/status changes/uploads/downloads have actor/time/entity/field names and no secret payloads; append-only access enforced; failed-login/denied-action monitoring needs additional work noted in the findings report. |
| UI | Arabic/English RTL/LTR, original assets/colors, desktop/tablet/mobile, browser console clean, sensitive localStorage reads/writes absent in central mode. |

## Backup/restore checklist — before calling cloud recovery verified

- Do not assume Free includes downloadable backups/PITR or a sufficient retention policy. Confirm actual features/limits and arrange independently encrypted database **and object** copies. No paid feature is authorized.
- Capture the application schema, migration ledger, row manifest/checksums and all referenced immutable encrypted object versions from a consistent snapshot. Pause pilot writes during capture or design an exported snapshot/manifest protocol; the current helper does not solve concurrent DB/object capture.
- Back up required SQL role/ACL/bootstrap instructions separately: `pg_dump` does not include cluster roles/passwords. The local restore used the same cluster, so independent role recreation has not been proved.
- Keep data keys and backup keys independently protected and recoverable, outside the backup archive. Current helper is memory-based and has no scheduler, streaming/cloud export workflow, retention or offsite automation.
- Restore only into a NEW approved isolated destination. Never use `--clean`, reset or restore over the source. Verify ownership/SECURITY DEFINER privileges after a no-owner restore, apply restricted runtime/scanner role setup, restore object bytes without overwrites and check table/object manifests.
- Revoke/expire restored sessions before allowing logins. Supabase Auth users are a separate recovery dependency: do not assume copying application UUIDs restores Auth identities, passwords, MFA or provider sessions. Establish and test a supported Auth recovery/reconciliation strategy before any real use.
- Test fresh login, company/bank/manager/user/grant/version reads, unauthorized access, missing/corrupt object, wrong keys and corrupted archive. Report RPO/RTO from measured cloud drills; no RPO/RTO guarantee is currently established.

The owner authorized proceeding to practical synthetic testing after project/secret setup. Continue that approved work when the connection becomes available. Do not merge #10/#11, deploy, create additional cloud resources or migrate browser data.
