# Employee login creation: req-8p diagnosis

Repository: `dubai717/ab-group-demo`, staging only.

## Verified deployed failure

Render service `ab-group-demo` was running commit
`27084ad5dbb0745cefaafe59ea33c3415cf77dfc`, deployed on 18 November 2026
at 09:35 UTC. This commit includes PR #99. Render's application log at
09:40:24 UTC (13:40:24 UAE) reports:

```json
{"event":"user_enrollment_failed","reference":"req-8p","stage":"validation","code":"employeeLinkConfirmationRequired"}
```

The same error appears for the adjacent req-74 and req-9a attempts.
There is no providerCode or database constraint in these log records.

The employee-link confirmation guard runs before durable enrollment reservation,
Auth creation, application-user insertion, memberships or employee linking.
Consequently this particular rejected attempt did not create a partial account.
Read-only Supabase inspection found no v1 enrollment receipts or tracked Auth
enrollments at diagnosis time. This is not a claim about unrelated legacy Auth
identities and does not authorize deletion or adoption of any identity.

## Root cause and correction

The employee-link checkbox already had `required`, but lacked a `name`.
The shared form validator disables native form validation and skips unnamed
controls. An unchecked confirmation therefore escaped browser validation and
reached the server as false. The server correctly rejected it; the frontend
did not translate that error and displayed the generic server/Auth failure.

The new browser regression reproduced the original generic error before the
fix. The correction:

* Names and identifies the confirmation control so validation, focus, error
  association and dirty-form tracking can address it.
* Rejects an unconfirmed employee link locally before POST, preserving inputs.
* Adds a second pre-request guard and bilingual, specific error handling.
* Returns a structured field error from the existing server guard, retaining
  its strict boolean check and existing owner/permission restrictions.

Confirmation is never selected automatically. No Auth, role, company, employee
or financial policy is weakened. Existing durable enrollment recovery remains
authoritative for failures after Auth creation.

## Verification and live-test boundary

Isolated PostgreSQL/API tests cover missing/false/string confirmations before
Auth; successful employee linking; descriptive work scope not granting access;
Auth failure; an already-used email; injected role, membership and employee-link
failures after Auth; resumption with the same Auth identity; replay; and
preservation of existing grants, role definitions and safe diagnostics.

The actual browser test covers unchecked confirmation with zero POSTs, inline
focus, retained credentials, subsequent explicitly confirmed creation, closed
form, refreshed user list and canonical employee link. Existing failure/retry,
duplicate prevention, AR/EN and responsive checks remain in the suite.

These are isolated tests with explicit Auth/storage doubles. A successful new
account creation against hosted Supabase Auth has not been asserted. It needs
an authorized test-account session and the reviewed deployed version; no owner
session is forged, credentials extracted, or Auth identity inserted via SQL.

## Bundle and storage constraints

The complete vehicle-order text was received and is implemented in this same
PR. This correction is not deployed independently. The combined review is in
`vehicle-request-workflow-review.md`; historical money and existing permissions
remain unchanged.

The legacy `/workspace` filesystem is full: Docker local volumes account for
28.45 GB and there is no build cache to reclaim. Those volumes are retained.
Source changes and tests use the independent checkout in `/tmp` of the same
repository. A generated test log was preserved and hash-verified in `/tmp`
before its duplicate bytes were cleared; no source, attachment, database,
backup or secret was deleted. No further destructive cleanup is authorized.
