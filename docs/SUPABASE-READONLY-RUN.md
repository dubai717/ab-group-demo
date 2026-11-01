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
