# Original company import — disabled by default, isolated acceptance

The existing company file preview now has a bounded create-only apply path. It reuses the original company policy/validation, `persistCompany`, licence writer, audit and `request_dedup` receipt; no parallel directory, import job store, accounting ledger, schema migration or role is created.

`Options.companyImportEnabled` defaults false and is **not enabled by server.ts, Render or any hosted configuration**. The normal Owner company preview remains read-only, and `/run` rejects with503 while disabled. There is no browser switch to enable it. The synthetic fixture explicitly enables it only against its owned random local database.

## Source and authorization

Preview stays repeatable-read/read-only and is not cached in request_dedup. The source token binds original actor/tenant, exact source bytes, current company identity/revision/status facts and complete row plan. Existing matches and similar source rows are marked for review, never automatically merged or treated as a global licence identity. Unknown columns/encodings, bad required fields/dates and source duplicates remain visible.

Apply requires the actual active Owner's original company read/create authority, original work-activity gate, enabled option, UUID idempotency header, exact preview token and explicit confirmation. The existing security mutation lock and a company-directory transaction lock serialize authorization/directory facts before loading the model; original company mutations share that directory lock. Current authority is checked before a cached apply receipt can be returned. No permission/membership is granted.

At most25 valid new companies can be created in a transaction. By default any rejected/review row stops apply. The Owner may explicitly choose to create valid new rows only and leave all others for review; the result is `CompletedWithReviewRows`, with separate created/skipped source rows. Existing records are never updated. No zero-row fake success or historical import.

## Recovery and interface

The complete batch, original licences/audits and receipt commit atomically. Same key/body recovers the original outcome. Independently keyed concurrent attempts from one preview cannot both create records; a changed directory requires a new preview. The test injects a late local PostgreSQL fault, proves full rollback and retries the original key after removing only that owned synthetic trigger.

The existing company preview requires confirmation, retains source/skip choice, blocks duplicate submits and freezes the exact request while outcome is unknown. A lost committed response retries the same key/body. After server acknowledgement, a failed readback retries **GET only**. Original bootstrap and bounded original register refresh verify created IDs, update counters and preserve search/filter/page. Source controls collapse after verified completion, while the original field layout remains available. CSV results reuse the original safe csvCell encoder, with accepted/rejected/save outcome and correction fields. Source-file-specific table keys prevent another file's preview filters from carrying over.

## Evidence and limits

- `company-import-apply.test.ts`: actual original API/PostgreSQL, same/different-key races, stale preview, default-disabled cache denial, source duplicates, explicit skips,25-row bound, late rollback/recovery, denied employee, unchanged old companies/grants/journals.
- One18-case linked native run including original company CRUD, permission/admin/concurrency, original customer/vehicle imports and View As passed. Current TypeScript/provider-free build and162 root checks passed.
- Actual enabled original-register AR/EN1440/768/390 journey passed: lost committed reply, exact retry, post-acknowledgement GET-only recovery, actual one-company creation, retained register filter and CSV report. Complete42-journey operational acceptance passed exit0, including enabled synthetic apply and default-disabled original preview.

This does not complete centre/employee/document/opening-balance imports, broader review/update adapters or full V1 acceptance. Real import and protected production/staging activation remain unauthorized. No hosted data/configuration, balances, historical company, contract, salary/commission or permission was changed.
