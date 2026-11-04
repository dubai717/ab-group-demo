# Runtime authentication compatibility diagnosis

This investigation uses only administrator READ ONLY transactions, DNS inspection and fixed status messages. It does not reset passwords, change privileges/RLS, register roles, rerun migrations or create ERP fixtures. Stored verifiers stay in runner memory and are never logged.

## Code-level finding

`backend/actions/runtime-setup.ts` generated the approved existing-role SCRAM verifier with **65,536 iterations**. Supavisor's official fix [PR #1222](https://github.com/supabase/supavisor/pull/1222), merged 2026-10-01, explicitly supports custom iteration counts only up to **32,768**; higher counts are rejected. Earlier versions advertised 4,096 regardless of the stored count. This is a compatibility defect in our credential-provisioning helper, not evidence that the independently saved password is incorrect.

## Proposed correction — not executed

Re-derive the verifier for the **same** password already held in the protected DATABASE_URL using SCRAM-SHA-256 with **4,096 iterations** (compatible with both behaviors). Replace only the existing role's stored password verifier once, compare role attributes/memberships/table privileges/RLS before and after, and test independent login. Do not rotate the plaintext password or replace GitHub secrets; do not grant memberships or disable RLS. Preserve all eight migrations. This is a database credential modification and awaits the user's explicit approval after diagnosis. No correction is claimed tested in the cloud until applied and authenticated.

Read-only workflow: `.github/workflows/supabase-auth-inspect.yml`, branch `verify/supabase-test-auth-inspect-20261102`. The API/storage/ERP trial remains separate and gated by successful runtime authentication.

## Actual administrator inspection

[Run 41440505617](https://github.com/dubai717/ab-group-demo/actions/runs/41440505617) succeeded on 2026-11-02 at 11:55 UTC:

- LOGIN=true, not expired, superuser=false, bypassrls=false.
- Stored SCRAM-SHA-256 cost=65,536; decoded DATABASE_URL password matches the stored verifier.
- Session pooler role is correctly `ab_runtime.<matching-project-ref>`, port 5432; node-postgres URL interpretation matches.
- Direct connection uses `ab_runtime` without suffix. DNS is IPv6-only; the prior direct probe returned network-unreachable, not a password rejection.
- Server password_encryption is scram-sha-256.
- No database changes were made.

The helper correction to generate 4,096-iteration verifiers is prepared on the development branch only. The live runtime verification branch has not been advanced to this correction; no credential-modification workflow was triggered. Existing verifiers remain at 65,536 until separately approved. Historical reports about a possible cache cause are superseded by this concrete incompatibility finding; no further restart or support ticket is needed before attempting the approved correction.

## Approved correction applied — 2026-11-02 12:00 UTC

The user explicitly approved a same-password SCRAM correction. [Run 41441112863, attempt 2](https://github.com/dubai717/ab-group-demo/actions/runs/41441112863/attempts/2) confirmed independent ab_runtime Session pooler authentication with verified TLS, actual unscoped RLS denial and protected-table privileges. Role attributes, memberships, table privileges and RLS stayed unchanged. The helper validates the existing verifier against the saved password before modification, accepts only the known 65,536→4,096 correction and skips modification when already at 4,096. A cold local PostgreSQL test verifies mismatch refusal, unchanged plaintext password and retry idempotence.

The first immediate post-change connection was rejected; one bounded retry succeeded without rewriting the corrected verifier. No project restart, credential rotation or new roles.

The synthetic trial stopped **before any fixture creation** because GitHub Environment `supabase-test` did not provide DATA_ENCRYPTION_KEY to the job. The user's statement that it was saved does not establish observed readiness. Action: place the existing intended key under **Environment secrets**, named exactly DATA_ENCRYPTION_KEY (not Variables), without displaying or sending its value. Preserve the existing key if already generated; do not rotate it. Then rerun **failed jobs only** on run 41441112863, which skips the already successful runtime job and starts with encryption-key readiness. Auth/company/bank/upload trials are pending, not passed.

Development workflow restored to verify-only mode for future pushes. The historical runtime snapshot remains idempotent. No main merge or deployment.

## Next interface trial (prepared, not deployed)

After synthetic API/storage trials pass, serve the current frontend and backend together on a trusted local machine (`APP_ENV=local`, `PUBLIC_ORIGIN=http://127.0.0.1:3100`, backend bound to loopback). Inject secrets from that machine's protected secret store into the backend process only; never into runtime-config.js, browser storage, GitHub Pages or a public runner port. Use a separately provisioned synthetic user, not runner fixture passwords printed into logs. A controlled staging endpoint would need separate deployment approval. GitHub Actions by itself is not an interactive hosting environment. A scanner is still required before quarantined documents can be marked clean; no fake clean status.

## Actual synthetic trial passed — 2026-11-02 12:10 UTC

[Run 41441112863, attempt 3](https://github.com/dubai717/ab-group-demo/actions/runs/41441112863/attempts/3) reran only the previously failed synthetic-trial job. The successful credential-correction job was reused. DATA_ENCRYPTION_KEY was observed present with the required canonical Base64 encoding of exactly 32 bytes; its value was never printed.

All 14 live stages passed: independent runtime authentication; rejection of wrong credentials; actual Auth login; company central persistence/retrieval (including Salik/Traffic Code); multiple bank accounts for one company; bank-manager persistence; new fictional-user login; unscoped RLS denial; application bank-access denial; encrypted private-object upload and decryption check; anonymous-object denial; ordinary authenticated-user object denial; pending-document quarantine; logout. The workflow completed successfully without an impactful error in these tested flows. No migration, role/grant/RLS change, deletion, restart, merge or deployment was performed in this attempt. Fictional accounts/records/files were retained.

This is a real API/Auth/PostgreSQL/Storage integration test, **not** an interactive cloud UI trial or evidence of production readiness. File downloads remain quarantined until a real scanner is configured. Existing local browser tests are not rerun or represented as live-cloud browser coverage.

The next practical step is to identify the user's trusted desktop OS (Windows/macOS/Linux), then provide its protected-secret-store setup for the existing loopback backend and frontend. No plaintext backend.env, public tunnel or GitHub Pages secret injection is needed. A separate synthetic interactive login must be provisioned securely; automated fixture passwords are not recoverable from logs and must not be published. There is no interactive endpoint deployed by this workflow.
