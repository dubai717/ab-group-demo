# Customer save recovery (Staging follow-up to PR #105)

## Verified failure mechanisms

- Customer notices were written to `#cu-notice` outside the modal dialog. API/policy failures therefore left the editor open without an actionable visible message.
- A browser reproduction of a failed create followed by a lost, already-committed response left the save button disabled even though `OperationUI.active()` was zero, the form had no `centralBusy` flag, and `inert` was false. The shared operation indicator and the customer form competed for ownership of the button lock. Customer requests now keep the shared progress indicator but leave control locking to the existing customer form guard.
- Customer requests had no timeout, and finalization awaited draft persistence, record readback, register refresh and summary refresh. A blocked network operation could hold the UI indefinitely. Customer requests now abort after 30 seconds; timeout means an uncertain outcome, never proof of rollback.
- The default successful action returned to the register. It now opens the saved customer in readonly view with the server-confirmed file number. Summary refresh failure cannot turn a committed save into an unconfirmed creation. The form-owned lock is released before the saved readonly file appears; background summary refresh neither blocks immediate tab navigation nor redraws a newly selected tab/editor. Refresh results are applied only to the same saved customer.

## Recovery and validation

The customer editor retains an immutable create request (including its draft reference and idempotency key) across uncertain responses. A retry replays that request through the existing server idempotency transaction. If inputs changed meanwhile, the previous creation is recovered before applying an edit to its confirmed identifier. Successful per-file uploads retain their own idempotency receipts. No browser storage, parallel numbering mechanism or new database table was added.

Errors and progress appear inside the active dialog, with field messages and focus on the first invalid control (including controls in disclosures). Server validation returns safe field names and request references. Diagnostic events contain stage, sanitized code, HTTP status and SQLSTATE only; no request bodies, names, identifiers, phone numbers, passwords or tokens. Newly entered Emirates IDs use the existing 15-digit 784 format, including Arabic/Persian digits; passport numbers remain international text rather than an invented national pattern. Unchanged historical identifiers/phone numbers remain intact. The existing authorized legacy-import path preserves source identifiers (including leading zeros); this internal validation mode cannot be selected in a normal customer API request. The isolated TEST_DATA fixture uses a valid-format explicitly fictional Emirates ID rather than a marker string. Uploading evidence remains independent from human verification.

## Summary

The final column is `إجمالي العملاء / Total customers`. Authorized registered companies remain dynamic; adding a company requires no source change. Company columns may overlap; the global total counts canonical customers once. An additional explanatory count identifies customers without a recorded residency, sponsor or registered-vehicle relationship to authorized companies, while retaining their existing record-administration scope. No links are fabricated, removed or reassigned.

## Evidence and limits

- A read-only inspection of Render confirmed affected live commit `52483e17ee8aac802c04c86aa0df96f835b52def`.
- Render/Supabase logs available for the reported time did not identify a failed customer transaction. An aggregate-only query of customer creations and draft updates between 09:35 and 10:15 UTC on 19 November 2026 returned zero. This does not identify an individual browser request or prove what happened outside that window.
- Isolated integration tests cover safe field errors/reference, optional documents, immutable creation replay, existing duplicate review, permissions, dynamic company summary, distinct totals, financial read-only projections and custody preservation.
- Actual browser tests cover required-field focus, invalid identity, a visible 503 with reference, connection loss after server commit, retry with one customer, timeout, optional file upload recovery, readonly success/file number, duplicate candidate links and prevention, counts, Arabic/English desktop/tablet/phone, and linked vehicle/request/financial regressions.
- Hosted creation must still be checked using an authorized Staging session after the protected deployment. Local synthetic success, CI success and merge are not proof of hosted creation or deployment.

No migration, historical financial update, grant change or Production deployment is part of this fix.
