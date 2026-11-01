# Limited company-profile and save fix

Base: local company-document commit `b867a01`. Branch: `fix/company-profile-save`. The preceding area/document work remains intact. No `AGENTS.md` was present.

## Already present and retained

- Per-company `salikAccountNumber` and `trafficCode` inputs, string storage (including leading zeros), search and dedicated filters.
- Company-register action opening the existing company file, document previews/replacement, canonical licence expiry date and optional card dates.
- Company creation already inserted a row and attempted local persistence; company-document updates already had permission and failure guards.
- Role definitions, existing file/alert behavior, seven emirates and the source-attributed area reference.

## Narrow fixes

1. Extend the **existing** company-file form to display/edit the fields already present on the new-company form: names/code, status/logo, licence data, contact details/location, tax/entity/founding/responsible-person fields and notes. Existing document slots, dates and government-code fields remain single controls within that form. Historical generic attachment names are displayed and retained, not replaced with an empty array.
2. Use **Save data / حفظ البيانات** for initial creation and **Save changes / حفظ التعديلات** in the company file. Successful creation clears old register filters as before, exposes the new company in the register and shows a local-save confirmation. Opening/closing/reloading the company file reads the saved company values.
3. Only modified profile fields are patched. Unedited legacy names, locations (including non-UAE records), invalid historical date text, IDs, custom data and other companies remain untouched. Inputs without a persisted value are not automatically written as empty fields. An explicit location change uses the existing shared area validation, not a separate list. Reusing the area widget with a form/prefix argument avoids duplicate DOM IDs and keeps the original creation widget working.
4. `saveState()` confirms its serialized write with a matching localStorage readback before reporting success. Storage exceptions/mismatches produce failure, never a success confirmation. Creation removes only the just-created in-memory row on failure; profile edits restore the previous record. Submitted forms guard against double submission while files are being read. Old success messages are cleared before a new save attempt.
5. Existing `edit_company`/owner checks remain authoritative in the demo profile service. Read-only users can open the company but cannot save edits. No role permissions are modified. Only allowlisted company fields can change; company IDs, creation metadata and attachment-name arrays cannot be injected via profile payloads. Profile/table output is escaped for edited text.

## Storage limits

This remains a localStorage-based static prototype, not a shared production database. Verified save means this browser/origin returned the same serialized state immediately after the write. It does not guarantee cross-device availability, backups, protection against storage clearing or multi-tab transactional consistency. Quota/permission errors and failed verification do not claim success.

Sensitive official document bytes retain the preceding session-only preview behavior and are not saved to localStorage. Dates/codes/profile data use existing local storage. The pre-existing public company-logo mechanism is reused for logo edits; do not upload confidential documents as logos. No new authentication, document backend, report/alert logic, central synchronization, deployment or merge is included.

## Validation

- `node tests/company-profile-save.test.cjs`: partial updates, other-company/unknown-field preservation, rollback, unchanged permissions, explicit location validation and storage write/readback success/failure.
- `tests/company-profile-save.browser.cjs` (Playwright): create → confirm → register → open → edit → save → close/reopen → page reload; existing Salik/traffic fields; reused area selection; failed update/creation under simulated quota failure; unique IDs; Arabic/English and mobile; owner/GM/read-only roles.
- Re-run existing company-document, area-reference, storage and browser regression suites. Optional browser tests accept `ERP_DEMO_URL` and `CHROMIUM_PATH`; local screenshots go under `work/`.
