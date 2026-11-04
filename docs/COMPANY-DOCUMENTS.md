# Company official documents, government codes and expiry alerts

## Inspection and change boundary

The branch `feature/company-official-documents` is based on local area-reference commit `590a36a` to preserve the current emirate/area workflow. Other independent development branches are retained. No `AGENTS.md` was found in the workspace.

Before implementation:

- Companies already had `tradeLicenseNumber`, `issueDate`, **`expiryDate`**, `entityNumber`, `establishmentDate` and an untyped `documents` array of file names. The generic uploader did not store document bytes or provide a protected viewing service.
- Reports were an empty placeholder; notifications were a fixed `notificationList`. There was no expiry scheduler or delivery provider.
- The Node server serves static files. There is no secure authentication/database/private file store. Existing demo accounts and browser storage remain a prototype, unsuitable for confidential production use.

This implementation adds metadata and UI within the existing application, without changing role definitions, existing company fields, original attachment-name arrays, the area reference, logo, palette or other user/task functions. The original generic uploader is retained; the new typed official documents are not copied into that legacy name array.

## Per-company schema and no duplicated license date

| Document / code | Canonical metadata field | File handling |
| --- | --- | --- |
| Trade licence | Existing `expiryDate` reused | Session slot `tradeLicense` |
| Establishment card | `establishmentCardExpiryDate` | Session slot `establishmentCard` |
| Labour card | `labourCardExpiryDate` | Session slot `labourCard` |
| Company traffic code | `trafficCode` (string) | Not a file |
| Salik account number | `salikAccountNumber` (string) | Not a file |

`entityNumber` and `establishmentDate` retain their original meanings and are not duplicated as card-number or expiry fields. There is no new `tradeLicenseExpiryDate` property. All new uploads, card dates and codes may be empty; the existing trade-license-number rule is unchanged. Codes stay strings so leading zeros are preserved. No invented government-code format or uniqueness rule is imposed.

Every company gets a **Company file** action. It opens its document metadata, upload/replacement controls and available session previews. Form control IDs are distinct from the new-company form. The existing `expiryDate` can be updated here as the canonical licence expiry date. New company IDs use UUIDs to avoid accidentally associating documents from two simultaneous creations.

## Authorization and safe failure

- Company metadata visibility follows existing `view_company`, `edit_company`, `create_company` rights or active owner access.
- Existing-company metadata/file updates require `edit_company` or the owner. File bytes/previews require `edit_company`, explicit `view_company_documents` or the owner. Read-only company visibility does not expose filenames or file bytes. No existing role is given new permissions.
- Creation follows the existing company form's owner/create/edit permission rule. Current canonical actor status/role is rechecked in the document service, including at save and preview time.
- Alert-duration configuration is restricted to the owner or an explicit `manage_company_document_alerts` permission. The general manager can edit company documents under existing `edit_company`, but receives no new global alert-setting power automatically.
- Files must be non-empty PNG/JPEG/WebP/PDF up to 10 MB. These browser checks are demonstrations, not content-signature verification or malware scanning.
- Metadata is validated before applying files. Persistence failures restore the original company metadata/settings and preserve previous session files. Failed creation does not leave a partially saved new company. `saveState()` now returns success/failure; existing callers retain their old behavior.

Real authorization must be enforced on a trusted backend; browser role checks cannot protect real documents.

## Actual storage behavior — no false secure-storage claim

**There is no protected document storage in this version. Use dummy documents only.** File objects are held in a private in-memory map keyed by company ID and document type. Previews use temporary object URLs, with image/PDF display through the browser. Files are never converted to data URLs, added to application state, written to localStorage/sessionStorage/IndexedDB or uploaded to a service. The new typed filenames/MIME metadata are not serialized either. A replacement changes only the selected company's/type's file in memory.

Logout and reload discard these files. Navigating within the page preserves session files for authorized previews; object URLs are revoked on close/navigation/logout. PDF display relies on the browser's native viewer. There is no misleading “uploaded to server” or permanently stored-file status. The company UI explicitly explains this boundary.

Dates and government codes are saved with the company's existing **local** demo state. They are not centrally shared or protected server records. Existing legacy attachment-name arrays and existing public logo handling remain unchanged. The local demo's credential/storage mechanism is not made production-secure by this change.

A temporary document-action log records actor ID, company ID, action, time and affected field/type names, without file contents. It is not a durable or tamper-resistant audit trail.

## Search, reporting and notifications impact

- The existing company search includes traffic and Salik codes. Dedicated filters additionally support partial, combined matching and normalize Arabic/Persian digits and whitespace/hyphens, while retaining the original stored code. Status, emirate and area behavior remain intact.
- Reports now project the three document types for each visible company, their expiry dates, remaining calendar days and traffic/Salik codes. Blank dates are shown as not specified/not applicable; invalid historical date text is not rewritten and is marked invalid for calculation. Roles without company access retain the previous empty-report fallback.
- Notifications add a **derived** company-document expiry section alongside the existing notification table. They never append duplicate items into `notificationList`; that data remains unchanged. No tasks or notification messages are silently created.
- Default alert thresholds are **60, 30, 7** days. The current nearest active band is shown once per company/document, with distinct expired/today states. An empty date creates no alert even when a preview file exists; a valid date can create an alert without an uploaded file.
- Dates use Dubai calendar days, without time-of-day/DST drift. Durations accept 1–10 positive whole-number values from 1–3650 days, normalize duplicates and sort descending. Explicit changes are saved in `companyDocumentAlertDays`; missing/invalid legacy configuration is read with defaults without rewriting old state.
- **Alerts are calculated only when pages render. There is no background delivery, SMS/email/WhatsApp or automatic notification when the application is closed.** These need the server scheduler below. Duration settings apply to company documents in this browser, not to a central multi-user system.

## Backend required before real use

1. Trusted authenticated sessions, server-side company/scoped permissions for every metadata read, file upload/view/replacement, report and alert-setting action. Define dedicated document and alert-setting permissions without widening existing user roles implicitly.
2. A user/company database with stable company IDs and company-document type/version records. Reuse the existing canonical licence expiry date or migrate it through a reviewed compatibility view; do not maintain two authoritative licence dates. Add card expiry dates and string traffic/Salik codes without losing legacy fields/attachment references.
3. Private encrypted object storage with opaque object IDs, company/type associations, content-signature validation, malware scanning, upload limits, short-lived authorized preview links, audit and retention/versioning. Do not expose a public upload directory or store file bytes in browser storage. Replace a document atomically and retain prior versions according to approved policy.
4. Transactional metadata/file association, optimistic concurrency controls and an append-only audit trail. Creator/editor identities and timestamps must be set by the server. Roll back failed uploads/associations without losing the previous document.
5. A daily job in `Asia/Dubai` evaluating expiry metadata, honoring configurable thresholds, and producing authorized in-app/provider notifications. Use a deduplication key such as company + document/version + expiry + threshold; reschedule after replacements/date/threshold changes and cancel stale alerts. Define recipients, retry/idempotency and delivery auditing. Do not claim a delivered notification before its provider outcome.
6. Authorized report queries against the same canonical metadata and document service, with privacy-aware exports. Migrate test metadata/files only through a reviewed plan; do not import demo credentials or assume temporary session files survived.

No backend, protected production storage, provider delivery, deployment or merge is included here.

## Validation

- `node tests/company-documents.test.cjs`: per-company isolation, existing-field preservation, preview replacement without file serialization, permissions, optional fields, calendar dates, default/exact/configurable bands, no duplicate notifications, persistence rollback (including thrown errors), invalid files, code normalization and report visibility.
- `node tests/storage.test.cjs` and `node tests/area-reference.test.cjs`: old-state and shared-area regressions.
- With Playwright installed, `node tests/company-documents.browser.cjs`; optional `ERP_DEMO_URL`/`CHROMIUM_PATH`. Covers three upload slots, previews/replacement, government-code filters, reports/alerts/settings, optional values, metadata reload vs file loss, company isolation, owner/GM/read-only access, Arabic/English and desktop/mobile, no JavaScript exceptions. Screenshots are local `work/company-doc-artifacts/` files.
- Existing login, users, company creation/generic attachments, tasks and area-search/addition flows are also regression-tested. Real encryption/private storage, durable auditing and scheduled notification delivery cannot be tested until a backend is implemented.
