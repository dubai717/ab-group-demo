# Original personnel import preview — unpublished and read-only

The original personnel register now exposes an Owner-only CSV/XLSX preview through the shared import dialog. It preserves the full original personnel profile and editor. No new HR register, employee writer, permission model, salary ledger or Auth identity is introduced.

`registerEmployeeImportPreview` receives the original personnel `person` schema and `checkLinks` callback. Required names, job, hire date, existing Active legal employer, original create authority and phone validation therefore follow the original creator. Unsupported identity, user-account, salary and grant columns are rejected rather than discarded. The current bounded template intentionally covers basic employee data only; documents and more complex organization mappings remain unfinished.

The preview is a repeatable-read, read-only database transaction and is excluded from original idempotency receipt caching. It consumes no employee number, creates no EOS snapshot, performs no Auth operation and writes no source rows to request receipts. Up to200 source rows are reviewed. Existing names, normalized phones/emails and earlier source matches produce review candidates, never a proved unique identity or automatic merge. Existing-match output is limited to original employee ID/number for the Owner. Individual field errors preserve the source row.

The shared dialog retains selected files on failure, offers original CSV/XLSX templates and a safe CSV results report, and rejects responses after actor/CSRF/authority/language/page changes. There is no employee apply endpoint or save button. The company batch writer remains separately disabled by default; this preview does not activate it.

## Reproducible acceptance

- `backend/tests/employee-import-preview.test.ts`: actual owned random localhost DB; original schema/link/date/phone checks, required names, missing company, possible existing/source duplicate, original employee creator, repeated read parity, no receipt/employee/grant/journal changes, unauthorized rejection.
- `backend/tests/employee-import-preview.browser.cjs`: actual original staff register, CSV template/report, actual preview, no employee writes, AR/EN1440/768/390. Screenshots inspected with the existing brown identity.
- `backend/tests/import-context.browser.cjs`: employee preview joins original customer/vehicle/company held-response context tests. No actual grant changes or target imports.
- Original company preview regression passed again after shared-dialog extension. TypeScript, provider-free build and162 original root checks passed. Linked personnel and full43-journey runs are recorded separately; a running test is not a success claim.

## Still incomplete

Employee apply, original duplicate-review decisions and immutable receipt recovery, attachment batch mapping/scanning and final organization/company-scope integration remain engineering work. No real import or deployment is authorized. No hosted data/configuration was read or changed by these tests.

The coherent linked personnel run passed65 cases, including the original encrypted HR backup/isolated restore parity test. The environment's full `/tmp` prevented Docker exec from starting; an optional test-only native PostgreSQL adapter avoided that infrastructure failure without deleting files. The adapter rejects hosted/non-owned source names and non-new restore target names. Its guard unit test passed. Native binaries and fake credentials are local test inputs, never repository artifacts. Docker remains the default in CI. This synthetic success does not prove a current independent hosted Auth/Storage backup or authorize any operational restore.

Full43-journey UI suite passed with exit0 on9af90dca09a8e6df406ff114dc4da4fcfb659830. The subsequent localized field-error/readiness correction passed11 focused native cases and the actual AR/EN three-width employee browser again, plus TypeScript/provider-free build. It distinguishes required fields from invalid formats, binds company/phone errors to the source field, and returns original personnelSchemaPending without creating a missing schema. The65-case HR run predates this small correction; these are separate evidence sets.

Follow-on: the previously unimplemented basic apply path is now built and tested behind a default-off option; see [original employee apply](EMPLOYEE-IMPORT-APPLY.md). Earlier preview-only evidence remains historical, not evidence of production enablement.
