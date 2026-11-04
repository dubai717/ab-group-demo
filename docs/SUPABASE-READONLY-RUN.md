# Actual GitHub read-only verification — 2026-11-02 (Dubai)

Branch: `verify/supabase-test-readonly-20261102`.
Tested source: `05a52495c5bc4afec9e1f584546d5f03919adbd2`.
Run: https://github.com/dubai717/ab-group-demo/actions/runs/41360868282

- Actions runner, pinned checkout/setup-node, and package installation succeeded. All four required secret values were present (their values were never read into this workspace or printed).
- The first connection failed TLS certificate trust. A public Supabase CA was obtained from the official CLI repository at an immutable revision, fingerprint/expiry verified, and added using NODE_EXTRA_CA_CERTS. Hostname and certificate verification remain enabled.
- The next actual read-only connection reached database authentication but failed with allowlisted diagnostic `DATABASE_CREDENTIALS`.
- Database connection is **not successful yet**. Cloud migration status, RLS and bucket/API checks are not claimed verified: the existing preflight stops at the failed SQL connection.
- No SQL migration, role creation, Auth user creation, record creation/edit, bucket mutation, reset, merge or website publication occurred. Earlier local suites were not repeated; only the changed read-only guard, safe diagnostics and public certificate were checked.

## Only required owner action

Update the existing GitHub Environment `supabase-test` secret **MIGRATION_DATABASE_URL** using the exact **Session pooler / port 5432** connection for `ab-group-erp-test` from Supabase Connect. Replace any password placeholder with the actual **database password**, not an API key. Preserve the project's supplied username/hostname; URI-encode special characters in the password. Do not disable certificate verification. Do not reset/change the database password merely to retry this check.

Do not send the URI/password in chat. After saving, tell the assistant the secret was updated; the existing failed run can be rerun with the corrected secret without new local suites or a main merge. The source on this branch performs reads only and reports an absent schema as NOT_APPLIED without applying it. If the database password is unknown, report that fact without disclosing any value; do not make unapproved database changes.

## Precise diagnosis after owner-confirmed Environment update

Run: https://github.com/dubai717/ab-group-demo/actions/runs/41362791790
Source: `8484ac4979df7c56553bdf3787b28433954765ea`.

The immutable workflow uses `environment: supabase-test` and the expected secret binding. The new runner-only checks all passed: Session pooler endpoint syntax, project-qualified username, effective port 5432, postgres database, password presence, valid percent encoding, exact once-only driver decoding, no placeholder and no API-key-shaped password. No possible-double-encoding warning appeared. These are format checks, not disclosure of values.

The server response was specifically SQLSTATE **28P01**, now classified as **DATABASE_PASSWORD_REJECTED**, rather than the distinct tenant-routing or generic authorization conditions formerly combined under DATABASE_CREDENTIALS. The required correction is the current database password in the existing Environment URI. If it is unavailable, a password reset is a separate database change requiring owner approval; no reset was performed. No further identical run is useful before that correction. No data/schema writes or disclosure of secret values occurred.

## Successful actual read-only verification — 2026-11-02 (Dubai)

Run: https://github.com/dubai717/ab-group-demo/actions/runs/41365931859
Source: `6b75a816a09aad9abef8093c929e545ffb1d4298`.

After the owner reset the database password and updated the Environment URI, actual PostgreSQL authentication and verified client TLS succeeded. The pooler-aware client TLS check inspects node-postgres' encrypted, authorized TLS socket; pg_stat_ssl on the backend describes a different hop and is not used to misclassify client TLS.

The actual run also passed the four API-key/private-storage checks: no direct public/ordinary-user storage policies, existing ab-private-test bucket confirmed private, real Secret key accepted for bucket metadata, and real Publishable key accepted by the Auth settings endpoint. This does not prove password login for an ERP user or a real document upload/download.

**Cloud application schema: NOT_APPLIED.** The app schema/migration ledger were absent, so no claim is made that application RLS has been verified on the cloud. All checks were read-only; no migrations, roles, users, records or files were created/modified. Earlier failure reports above are historical.

Next owner approval needed: apply the eight reviewed forward SQL migrations to this existing synthetic project, without reset/deletion/import, then verify RLS/privileges before preparing Auth test subjects and ERP CRUD. No main merge, website publication or paid service is involved. Runtime and durable encryption-secret provisioning remain prerequisites before saving encrypted ERP trial records; no disposable encryption key will be used for durable records.
