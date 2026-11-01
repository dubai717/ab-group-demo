# Central database foundation — phase 1

## Review boundary

Based on `integration/erp-unified-review` at `6f14eb08d2adeeb72861880419f4f8c52208d8a2` (PR #10), on independent branch `feature/central-database-foundation`. Existing integration features and legacy browser data remain available in static demo mode. No cloud project, bucket, paid resource, deployment, merge, or browser-data migration was performed. Use synthetic data only. Production startup is deliberately refused.

## Two explicit modes

- `npm start`: existing static demonstration. Its browser-based credentials/storage remain a demonstration, not secure authentication. Do not enter actual personal or financial data. `runtime-config.js` disables central mode.
- `npm run backend:start`: same screens served by the Node.js/TypeScript backend, with central mode enabled by that server. This mode never imports or falls back to the browser's old user/company/account stores. Only locale preference may use browser storage. Success is displayed after a database transaction succeeds; failed secondary uploads are reported separately from an already committed record.

Official logo, CSS/colors, Arabic/English and original fields are retained. The legacy static server now serves an explicit public asset allowlist to prevent exposing the newly added backend, secrets, test artifacts and repository metadata.

## Schema and relationships

Seven ordered, checksummed SQL migrations are in `supabase/migrations`. The custom runner records immutable checksums in `public.ab_schema_migrations`; do not combine its ledger with a different migration runner. Apply forward migrations; there is no reset/drop on startup.

| Area | Tables and relationships |
| --- | --- |
| Group and companies | `organizations` → `companies`; independent `company_licenses`; company/area/emirate foreign keys; departments belong to companies. Existing primary-license fields are projected into the unchanged form. Multiple licenses are schema-ready; no additional license-management screen is introduced. |
| Geography | Seven `emirates`; tenant `areas` and normalized `area_aliases`, seeded from the existing 367-area reference. This seed is the repository's reference, not a claim of a newly verified government gazette. New areas are central within the group. |
| People | `users` maps to a Supabase Auth UUID; same-group manager; many-to-many `user_companies`/`user_departments` with inactive history. Identity information and contact-channel values are encrypted. |
| Authorization | Existing `roles`, `permissions`, `role_permissions`; scoped `permission_grants` with issuer, revocation and explicit delegation. Owner role is provisioned administratively; runtime cannot create/promote an owner or demote/deactivate the owner. Reporting cycles are rejected. |
| Banking | `bank_accounts` → company and optional license; multiple independent accounts; bank/purpose reference catalog; encrypted approved account/manager fields; exact decimal balance; normalized HMAC account/IBAN duplicate indexes; optimistic revisions. |
| Documents | `documents` belongs to exactly one company, bank account or user; append-only `document_versions` with parent version, author/time, metadata snapshot, checksum and scan status. Originals and previous versions remain intact. |
| Controls | `audit_events` append-only; `sessions` hashed opaque IDs with encrypted provider tokens; `request_dedup` supports retry-safe mutations; group settings and encrypted unverified `contact_channels`. |

Company traffic code, Salik, document expiry/alert settings, banking purpose/status/dates, relationship manager and existing user assignments are preserved. Existing shared policy/validation modules are used server-side, with current database grants reloaded for each operation. Company-scoped bank view/create/edit/close/documents remain independent. A short-lived encrypted enrollment capability permits an authorized create-and-attachments user to upload initial user files without granting profile-edit rights.

## Security architecture

Fastify validates mutation Origin and request headers; authenticated mutations require CSRF. Sessions use HttpOnly, SameSite=Strict cookies (Secure `__Host-` in staging), one-hour maximum, provider verification and current active-user checks. Username resolves privately to Auth email; invalid login returns a generic response. Passwords are sent to Supabase Auth, never persisted by the application. No provider JWT or session cookie is put in localStorage. Login is rate-limited.

Runtime connects as `ab_runtime`, never a table owner, superuser or bypass-RLS role. Transaction-local tenant context and RLS isolate groups. Finer company/action/delegation checks run in the trusted API using the existing policy: this is not a claim that SQL RLS alone implements every action permission. Runtime has no DELETE rights. Administrative migration/bootstrap credentials are separate. Server rejects insecure remote database TLS configuration.

AES-256-GCM encrypts private user fields, account payloads, provider session tokens and document objects. Keys stay server-side and must be protected/backed up separately. The Supabase service-role credential is server-only, for authorized private object operations and synthetic test-user enrollment; normal SQL uses the restricted runtime role. No credentials are committed.

Uploads use random immutable private object paths, no overwrite, type/signature and size checks, ownership authorization on every download and checksums after decryption. Files start quarantined. A separate trusted scanner role/worker can mark them clean or rejected; without a configured real scanner, downloads remain blocked. Scanner API availability is not evidence of a clean file. The backend never exposes a public bucket URL.

## Reproduce local verification

Prerequisites: Node.js with TypeScript tooling dependencies, Docker, Chromium, and Playwright accessible to the test runner. Browser tests currently use `/usr/bin/chromium`; adjust the executable for other environments. Playwright is an external test-environment prerequisite, not a production dependency.

```sh
npm ci
npm run backend:test:db
npm run backend:check
npm run backend:test
# Keep this explicit local synthetic provider fixture running in a separate terminal:
npm run backend:test:serve
# Then:
npm run backend:test:browser
```

The database helper starts a pinned PostgreSQL 17 Alpine container on loopback port 5441, with generated ignored local passwords under `work/`. It does not provision Supabase. Tests retain their synthetic databases, do not delete previous databases, and never import browser records. Production entrypoints do not import test doubles.

Backend tests cover real local PostgreSQL migrations/transactions/RLS, company create/read/update, multiple bank accounts, exact balances and manager fields, duplicate prevention, revisions/idempotency, scoped enrollment/grants, owner/cycle protection, encrypted append-only files, quarantine/scanner privileges, CSRF/cookies/static file isolation, and auditing. The HTTP provider-contract test uses a local stub, not the live Supabase service. The browser test covers login, company editing, bank manager persistence, document reload, user enrollment, Arabic/English desktop/mobile, blocked sensitive localStorage access and JavaScript errors.

Backup test creates an isolated source database, takes a real `pg_dump`, encrypts a checksummed archive plus already-encrypted objects using a separate backup key, restores into a NEW database with `pg_restore`, expires restored sessions and verifies records, file bytes, relationships and restrictions. Wrong keys fail. Object storage/Auth are test doubles: this does not demonstrate actual Supabase Auth restoration or cloud disaster recovery.

## Future staging setup — requires separate resource approval

1. Approve project ownership, data region and Supabase Free limits; create an isolated **test** project and private bucket only after permission. No cloud resource creation automation has been run.
2. Configure secrets from `backend/.env.example` in an ignored file/secret manager. Generate independent 32-byte base64 data and backup keys. Assign a separate managed runtime-role password; SQL migrations do not contain one. Retain the data key separately or encrypted records cannot be recovered.
3. Apply migrations with administrator credentials, explicitly: `node --env-file=backend/.env --import tsx backend/src/migrate.ts`. Do not use the administrator connection for the server.
4. Provision an existing synthetic Auth subject using the explicit bootstrap variables and `node --env-file=backend/.env --import tsx backend/src/provision.ts`. This creates a NEW group/owner mapping and reference rows, not a migration of current browser users. Do not silently change existing roles or credentials.
5. Start the backend with exported variables or `node --env-file=backend/.env --import tsx backend/src/server.ts`. Staging requires HTTPS origin and verified database TLS. Review secrets, private bucket, scanner, policies and real provider tests before authorizing deployment.

## Incomplete / required before real use

- No live Supabase project, PostgreSQL connection, Auth enrollment/login or cloud bucket has been verified. Local PostgreSQL and provider contracts are tested separately.
- Test enrollment uses Auth admin confirmation for synthetic email addresses only; it does not prove email ownership. Verified-contact enrollment, password reset/change, Email/SMS/WhatsApp delivery, OTP expiry/attempt controls and secure administrator recovery are not activated. Recovery UI makes this limitation explicit and never simulates successful delivery.
- Auth enrollment and SQL cannot share one transaction. If remote creation succeeds and SQL fails, an unmapped Auth subject can remain; it cannot access the ERP until mapped. Reconciliation requires a reviewed workflow. Failed object/SQL combinations can similarly leave inaccessible encrypted orphan objects. No automatic deletion of prior objects/accounts is implemented.
- Scanner service, real private bucket policies, key rotation/re-encryption, secrets management, monitoring and operational abuse controls require staging integration and review.
- Backup helpers/test are not an operational scheduler or offsite backup system. Configure retention, protected independent keys, Auth/provider export strategy and a real isolated cloud restore drill; Free database availability is not a backup guarantee. File objects must be backed up too. Current helper builds archives in memory, suitable only for limited trial data.
- Legacy browser data remains untouched. A field/identity/role mapping, dry run, encrypted export, reconciliation counts and explicit migration approval are required before any import.
- Tenant-wide transaction locking and full-group bootstrap snapshots favor correctness for the pilot; load tests, pagination and finer locking are required for larger use.
- Existing tasks remain available in static demo mode; central task persistence is explicitly disabled because this phase does not implement its schema/API. Other non-phase modules are not claimed to have central persistence.
- Company logo upload in central mode accepts small raster images (500 KB maximum); the existing official assets remain unchanged. Arbitrary SVG upload is not enabled.

No production readiness, central cloud availability, scheduled backup, verified recovery channel, merge or publication is claimed by this phase.

## Verification record — 2026-11-01

- TypeScript strict check, central-client syntax and whitespace checks: passed.
- Five backend test scenarios: passed against actual local PostgreSQL; provider/storage are explicit doubles. Includes actual dump/restore into a new isolated database.
- All eight legacy logic/storage test files: passed. All eight legacy browser suites passed during implementation; after the final static-server hardening, the broad legacy regression browser suite was rerun successfully.
- Central browser scenario: passed after final data/license changes; company create/edit/reopen, bank/manager persistence, document persistence, user enrollment, RTL/LTR desktop/mobile and zero JavaScript errors.
- Public static assets returned 200; backend secret/source, `.git` and local secret artifact paths returned 404 on the restarted static server.
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time; this is not a full security audit.
- Integration baseline remains `6f14eb0`; PR #10 remains an open unmerged draft. No live cloud test or deployment was performed.

## Follow-up verification — 2026-11-02 (Dubai)

The subsequent review found six unresolved SQL constraint gaps despite passing application-flow tests. Do not treat the schema as approved for cloud activation. See [verification results](PHASE1-VERIFICATION-RESULTS.md), [sanitized machine-readable findings](verification/schema-review-2026-11-02.json) and [gated Supabase runbook](SUPABASE-VERIFICATION-RUNBOOK.md). No runtime logic or applied migration was changed during this verification.
