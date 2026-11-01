# Bank accounts — implementation and storage boundaries

## Inspection and scope

Base commit: `d5622e9` (current local company-profile/save branch). Development branch: `feature/company-bank-accounts`. No `AGENTS.md` was found. Existing code contained general `view_finance`/`edit_finance` role permissions but **no bank-account screen, register, IBAN fields or document subsystem**. The new module supplies those missing workflows and reuses the existing company register, layout, language switch, local persistence confirmation and permission sources. Prior company/area/document work remains present; existing companies, users, role definitions and closed records are not deleted or re-created.

The server still serves static files only. There is no secure session/database/private storage backend. This change is a **demo**, not a production banking or financial service. Use fictional account data and dummy files only.

## Register and fields

The existing vertical menu gains Bank accounts for the owner and explicitly scoped operators. Each account has an independent UUID and references an existing authorized company ID; the company option includes its registered name. Multiple accounts per company are supported.

Fields: company, expandable bank reference, branch, account name, account number, IBAN, optional SWIFT/BIC, opening date, Active/Inactive/Closed status, conditional closing date, expandable/editable purpose reference, opening balance/currency and notes. Company, bank, account name/number, IBAN, opening date, status, purpose, balance and currency are required. Branch/SWIFT/notes are optional. A closed account needs a closing date not earlier than opening.

- The initial bank reference is explicitly labelled **Demo bank — test data only**, not presented as a verified bank directory. The owner/reference manager can add bilingual banks and purposes. Defaults are retained; duplicate reference names select the existing ID. Existing purpose defaults are Operations, Payroll, Savings, Investment and Other.
- Bank/account numbers remain strings with leading zeros. Balances are stored as exact decimal strings, with up to 18 integer digits and 3 fractional digits; no financial transactions, floating-point balance calculations or currency conversions are performed. Currency validation currently checks the 3-letter format, not a full currency/precision registry.
- IBAN validation is format/mod-97 checksum validation (15–34 characters, with UAE IBAN length 23); it is not bank verification, ownership proof or a complete country-specific registry validation. SWIFT validation is its 8/11-character structure. A production service must validate jurisdiction, bank identifiers and currency rules authoritatively.
- Save data inserts into the register after verified local persistence. Save changes opens/updates the existing account. Validation/save failures leave entered form values intact and restore the previous persisted-model snapshot. Success notices are cleared before another attempt. Local readback verification is inherited from `saveState()`.
- Duplicate normalized IBAN, or duplicate normalized account number within the same bank reference, is rejected across companies and statuses (including closed records). The error reveals no other company's data. Existing records are not silently merged.
- Closing is a separate action. Closed records remain viewable and retain linked documents; no delete endpoint exists. Closed status is terminal in this workflow, not an automatic reactivation path. Authorized metadata corrections and append-only documents remain possible. No-op submissions do not rewrite audit/update metadata.

## Explicit company-scoped rights

No existing role is given new banking rights automatically. The owner has all banking actions. Other actors require trusted per-company grants with independent actions:

`view`, `create`, `edit`, `close`, `view_documents`, `manage_documents`.

Demo schema read from the canonical user record:

```json
{
  "companyBankPermissions": [
    { "companyId": "company-ab", "permissions": ["view", "create"] }
  ]
}
```

This is an integration schema, not an authorization-management UI or a claim that browser grants are secure. This change does not modify the existing users/roles or provision grants. Production grants must come from an authenticated server and the approved permission-management workflow. Existing broad financial role permissions are unchanged and do not silently confer these new company/document rights.

- Company pickers expose only companies available for the relevant action. View-only users cannot edit; close-only users cannot edit ordinary fields. No-op view submissions are denied.
- Reassignment needs edit on the original company plus view/create on the destination; a closed account also requires close rights in the destination. No unauthorized company can be linked through a forged payload.
- Direct reads, writes, file reads and uploads recheck current actor status and company scope. Record IDs/creation metadata cannot be injected through account fields. Historical missing creator/date data is not fabricated on edits.
- Create-only rights can create an account without granting register visibility; seeing/reopening records additionally requires `view`. Managing uploads does not imply file-read rights; view/download requires `view_documents`.

## Document section, links and versions

Each account has a distinct document section supporting PDF, PNG/JPEG/WebP and non-macro OOXML DOCX/XLSX/PPTX. Limit: 10 non-empty files per batch, 10 MB each. The browser MIME allowlist is only an initial demo check; it cannot replace server content verification/scanning. Legacy macro-enabled/OLE/executable formats are not accepted.

After selecting files, each gets its own editable title, description, date, category (original contract, annex, amendment, bank correspondence, other), prior-document link and relationship type. Relationships are validated within the same account:

- Independent related documents have a new version lineage and may point to a prior document/contract.
- New versions reference an existing document, retain the version-root/contract-root IDs and increment the lineage's version number.
- Every record has its own ID, actor and upload timestamp. Adding a file never overwrites or deletes the original, even when filenames are identical. Batch validation is atomic; one invalid file/link does not partially append other documents.
- Images/PDF have browser previews; supported office files are downloaded to an appropriate application. Authorized download returns the original selected filename. Office content is not converted or rendered as HTML.

**These documents and all their metadata/links/version history are held only in page memory. They are never serialized to localStorage, sessionStorage, IndexedDB or the account state, and are not uploaded to a service.** Logout/reload discards them; they are not centrally available or durably versioned. The UI explicitly states this. Opening a record again during the same page session retains its documents; reloading retains only locally saved account metadata. There is no claim of protected central document storage.

Account metadata/reference changes have a local audit trail (`bankAccountAudit`) with actor, account/company IDs, timestamp, action and changed field names; full account values/file names/content are not duplicated into audit events. Upload/view events are session-only. This is not tamper-resistant server auditing. Existing account metadata and unknown fields are preserved when updating known fields; malformed stored account/reference data is not overwritten with an empty dataset.

## Central secure backend required before real use

1. Trusted authentication, server-side company grants and separate view/create/edit/close/document permissions on every endpoint; protected reports/search, rate limits and non-disclosing errors. Never trust localStorage roles or client company IDs.
2. A transactional database for companies, banks, purposes, accounts and durable audit records. Store exact monetary values under an approved currency-scale policy; encrypt sensitive bank identifiers, use stable foreign keys and database uniqueness constraints for canonical IBAN and bank/account identity. Preserve prior records in a reviewed migration. Handle concurrent edits using row versions.
3. Private encrypted object storage with account/document foreign keys, immutable version records and parent/version/contract relationships. Server-generated IDs/actor/timestamps, malware/content-signature/archive validation, short-lived authorization-checked preview/download links, retention, backups and recovery are required. Do not place files in a public static directory or browser storage.
4. Atomic upload finalization and version allocation, rollback of failed batches, concurrency-safe parent validation, no cross-account links, append-only history and no automatic removal of original/closed-account documents. Deletion/reopening policies require separate explicit approval.
5. A private office-document viewer/conversion service if in-browser office previews are needed. Do not execute uploaded office macros or convert untrusted files client-side as HTML.
6. Replace demo authentication/storage before real bank data, review bank/currency/IBAN registries and migration, then obtain approval before deployment or enabling shared production storage.

No central storage, banking API, money movement, production migration, publication or merge is included.

## Validation

- `node tests/bank-accounts.test.cjs`: required fields/checksums/dates, multiple accounts, duplicate detection, company/action boundaries, close-only rights, stable IDs/unknown fields, rollback, expandable references, append-only related/versioned documents, cross-account link rejection, unsafe batch rejection, no document serialization, retained closed records and reload/logout file loss.
- `tests/bank-accounts.browser.cjs` with Playwright: create/edit/multiple accounts, duplicate errors without losing input, closure, document batches/links/versions, preview/download, filters, local reload, unchanged companies/users/roles, no new file bytes/metadata in localStorage, Arabic/English and desktop/mobile.
- Existing company/profile, document, area, storage and legacy application regressions are re-run separately. Browser tests accept `ERP_DEMO_URL`/`CHROMIUM_PATH`; screenshots are local `work/bank-artifacts/` output.

Actual shared encrypted storage, authenticated server authorization, durable version history/audit and multi-user concurrency cannot be verified until the backend exists.

### Bank relationship manager

Each account optionally stores `relationshipManagerName`, `relationshipManagerPhone`
(including the international dialling code), and `relationshipManagerEmail`.
The existing create/edit form displays these in an Arabic/English section;
view-only accounts show disabled fields. Existing company-scoped create/edit
permissions and save buttons apply. Changes are recorded by field name in the
existing account audit trail. Legacy accounts need no migration; absent fields
appear empty. These contact details have the same browser-local demo storage
limitation as the account metadata, not central storage.
