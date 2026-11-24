# Company import source review — not an enabled importer

The original company register now opens an Owner-only file preview through the existing DataImportUI module. Empty CSV/XLSX templates use original company field names. Original parsers retain text licence values; unknown columns, invalid encodings, malformed quotes and oversized input are rejected. Preview is bounded to200 rows.

`prepareNewCompany` and `validateCompanyInput` in the original data module are shared with `persistCompany`. Preparation works on a clone, so preview cannot leave temporary companies in the live request model. The original company API still writes companies/licences/audit and retains its original create authorization; no new role, permission or membership is granted.

Matching name or licence indicates a possible match, not a globally unique identity. Preview reports it for review without merging or modifying any company. Exact repeated source rows are distinguished from existing possible matches. Dates/email/required field errors retain source row and field names. Retrying returns the same source hash and deterministic review, without storing an import job or creating a company. Preview/template require the actual active Owner and original company read/create authority.

There is deliberately no apply endpoint, confirmation button or fake successful-import message. The UI says preview only, retains failed files/reference, blocks duplicate submits and ignores results from obsolete account/session/language/page contexts. No real data or file was used.

## Evidence

- `backend/tests/company-import-preview.test.ts`: actual API, CSV/XLSX templates, original validation, exact source repeats, name/licence review, repeated deterministic preview, original company create, denied employee and absent apply. Company/licence/grant/journal rows compared before/after every preview.
- `backend/tests/company-import-preview.browser.cjs`: actual original register entry, template, retained file after503, trace, one submit, zero company/apply writes, field errors and AR/EN1440/768/390.
- `backend/tests/import-delimited-api.test.ts`: malformed quotes rejected before any preview row, source-company checks and original import/attachment/retry paths.
- Original company CRUD, security/admin and imports: one coherent19-case run passed. Provider-free build, TypeScript and162 original root checks passed. Focused original customer/vehicle CSV browser also passed.

## Still engineering, not an Owner decision

Durable company import receipts/atomic batches, explicit duplicate decisions, mapping/application UI, centre/employee/document/opening-balance adapters and complete import acceptance remain unfinished. Opening financial history additionally depends on PR115 and explicit historical-balance approval. This preview is not classified as a completed import requirement.
