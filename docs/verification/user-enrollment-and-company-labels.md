# Employee company labels and recoverable user enrollment

## Confirmed defects and limits

The employee register read `company.name`, while the legal company model supplies
`arabicName` and `englishName`. Its fallback printed UUIDs. Display now resolves
employment, active assignments and descriptive work-company IDs through the existing
permitted legal-company references, deduplicates IDs and adds the primary licence
when localized names collide. Unavailable references have a localized label, never
a company UUID. IDs, company links and access scopes are unchanged.

User enrollment previously called external Auth before inserting the application
user, memberships and employee link. An SQL failure rolled back the local request
receipt while leaving the external identity. A lost Auth response had the same
ambiguity. Employee enrollment also silently overwrote the selected login email
with the HR contact email. These failure modes are reproduced in isolated tests;
the basic old employee-with-email path succeeds. **The particular reported hosted
failure is not conclusively diagnosed without its protected Render/Auth logs.**
Do not interpret synthetic fault injection as observation of that live incident.

## Recovery and security

Validation, duplicate checks and employee hierarchy checks precede Auth. Existing
role, membership, employee-link and anti-escalation rules remain authoritative.
A password-bound HMAC fingerprint and encrypted operation receipt in the existing
`ab.settings` table survive rollback; no password is stored or logged. The normal
transaction already serializes enrollment by tenant. A small separate connection
pool commits only these receipt keys, uses tenant RLS and the existing shared
maintenance barrier, and avoids recursively taking the parent's tenant lock.

The receipt reserves an application ID before enrollment. Auth identities receive
server-owned `app_metadata` containing an operation UUID and tenant. Recovery must
match both and the email; it never adopts an existing identity by email alone or
trusts user-editable metadata. Unknown historical identities stop for authorized
review. No identity deletion, password reset, mass linking or old-data cleanup is
performed. A definite provider rejection permits correction; an uncertain attempt
requires unchanged input. Application user, scopes, employee link, completion audit
and idempotency result commit together. Errors retain inputs and expose a safe
reference; logs contain stage, bounded code and constraint, not credentials or PII.

The client verifies server readback before closing and immediately reveals the
created user, clearing stale register filters. Readback retry does not repeat POST.

## Verification

- PostgreSQL and API tests: employee email/contact separation, one-to-one link,
  explicitly chosen role and company/unit scopes, duplicate username/link,
  concurrent retries, SQL failure after Auth, lost provider response, trusted
  recovery and refusal to adopt unknown identities; old roles/grants unchanged.
- Loopback HTTP provider contract tests for legacy and modern Supabase keys,
  server metadata, paginated recovery and safe rejection handling.
- Actual Chromium flow: inline validation, busy/double-submit prevention, failure
  input retention, failed readback retry, close and immediate register visibility,
  reload, employee-with-email creation/link verification, localized duplicate
  company names/licences and no UUID text, desktop/tablet/mobile AR/EN.
- Existing backend, forms, document, scope and encrypted restore regression suites.

All writes use newly created synthetic databases and fake Auth/object stores.
Local test targets are configurable with validated `AB_LOCAL_DB_PORT` and
`AB_LOCAL_DB_CONTAINER`; CI defaults remain unchanged. The isolated container is
separate from the shared developer database. No application schema migration,
live account/grant changes, balances, secrets or production deployment is required.

Publish only through the existing protected staging delivery after native CI and
any required `staging-owner-approval`. Hosted smoke checks and exact published SHA
must be verified separately; local tests alone do not establish deployment success.
