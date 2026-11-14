# Operating billing 029: owner review required before deployment

Repository: `dubai717/ab-group-demo`; staging only. This proposal is separate from safe PR #88. Approved SQL catalog remains 001–027. Investor migration 028 is neither required nor activated.

## Exact scope

- Three additive operational metadata tables: `operating_bill_lines`, `operating_statements`, `operating_charges`; restrictive tenant/company/existing-financial-grant RLS, immutable source/approved history, original user grants untouched.
- Existing centralized `invoice`, `linkInvoice`, journal, voucher, receipt/allocation, document scanning/text extraction, workbook parser and audit engines are reused. No second invoice ledger or treasury.
- App endpoints fail closed when 029 is absent. No schedules or invoices are generated for any existing contract by the migration, startup or delivery. Each contract requires an explicit owner confirmation, immutable termsVersion=2 snapshot, valid future first-of-month effective date and a separately configured **operating** financial item whose revenue mapping resolves to an income account. Principal/loan items and items with a separate general recurrence cannot activate operating billing. Approved item mappings are fingerprinted; a later mapping change stops issuance pending reapproval. Existing manual contract-invoice routes are blocked after activation, and contracts with unreconciled prior manual bills cannot be activated automatically.
- Existing enabled financial scheduler is reused. No environment variable/secret is changed and the scheduler is not automatically enabled. It processes only explicitly approved operational schedules, rechecking permissions each time.

## Policy requiring approval

**Monthly operation and recurring services: calendar month end, in arrears.** Each vehicle retains its independent monthly rate, dates and explicit partial-month policy. `calendar_actual` uses inclusive operating days / actual days in that month; `full_month` charges each touched month in full. Amounts round half up to 0.001 per period. Displayed operating months do not multiply monthly invoices.

One-time services are issued once on their application/due date, in a separate invoice group if that date precedes month end. Vehicle services and contract-wide services have stable IDs; contract-wide partial-month policy is explicitly selected at owner approval. Monthly invoices combine vehicle/recurring-service lines under the explicitly mapped financial item. These snapshots remain accessible through invoice breakdown and contract report.

Future amendment cancels only unbilled future schedule rows, appends replacements and records the reason. An already billed calendar month cannot be recalculated. Pause/termination never changes an existing invoice. Legacy unversioned quantity/value/extras are not automatically reinterpreted or converted.

## Actual costs and fee invoices

- Salik/parking/fine/fuel/other statements retain the original file encrypted in PostgreSQL, scan verdict, parsed source rows and rejected rows. No browser-only storage. Same-file hash and normalized movement identity prevent duplicates; repeated statements can reference an existing movement without copying it. Conflicting values under one identity stop the operation.
- CSV and XLSX produce review candidates, never approved charges/invoices. UTF-8 CSV supports quoting; workbook parsing uses the existing bounded worker without executing macros or formulas. PDF text extraction and image originals are preserved for manual review; **automatic PDF table extraction and image OCR are not claimed**. Uncertain plate/date/contract matches remain NeedsReview. Manual additions can reference the original statement.
- Only an explicit owner review confirms vehicle, occurrence, contract/customer, amount, cost bearer and reason. Database triggers verify party/vehicle/contract/invoice/voucher relations and freeze approved rows.
- Customer-borne charges may be invoiced separately after review. Separate cost and bill amounts are preserved. Invoices group by company, customer/contracting party, contract, currency and UAE month; this keeps collection attribution to each contract exact. Several vehicles/movements in one contract may share a fee invoice. Mixed customers never share an invoice. Fees are never inserted into operating monthly invoices.
- Group-borne costs create the existing **Pending** expense voucher; no invoice for the customer, automatic approval, cheque, balance deduction or payment. Another party's costs remain a reviewed record with zero customer amount. Prior costs are never inferred to be paid.
- Invoice amounts, actual confirmed allocations, reviewed costs, actually paid expense vouchers, receivables, operational result and cash result are distinct. Expected profit is explicitly unknown without approved future cost estimates. Reviewed-cost operational margin is not presented as a new posted general-ledger P&L.
- Fee item/tax/expense mappings remain existing explicit financial configuration; no accounting treatment or account is inserted by the migration. Approve these mappings through the existing owner controls before real use.

## Isolated verification

Tests: TypeScript/build; pre-migration encrypted AES-GCM backup with authenticated restore and byte-exact existing tables/original objects; multi-vehicle independent schedules; one-time/monthly/multiple services; billed-month immutability; future stop; multi-party CSV and XLSX; PDF/image manual-review hold; duplicate files/movements, changed amounts, bad scan; separate individual/external fee invoices; actual cost vs billed amount; group expense Pending; no receipts created; concurrent invoice requests; unauthorized API/model/DB reads; approved-row immutability and original grants unchanged.

Actual browser review uses the same application/session/CSRF/idempotency wrapper, with a test-only clock in a generated app copy. Hosted source is never modified by this fixture. It covers monthly invoicing once, future contract-wide recurring service, separate reviewed fee invoice, unresolved movement blocked, original download, and AR/EN desktop/tablet/phone. The fixture never applies SQL to a hosted database.

## Application and recovery plan (NOT executed)

1. Specific owner approval of this PR, SQL 029, month-end policy, operating/fee/expense mappings and new frontend asset proof through the established protected path.
2. Fresh encrypted staging backup and proven isolated restore; compare company/contract/invoice/receipt/journal/permission/document fingerprints before applying any SQL. Do not use an isolated synthetic backup as a hosted backup.
3. Add only this reviewed SQL digest to the protected approved catalog using a separately reviewed controller change. Do not approve/apply 028 implicitly or change credentials/grants.
4. Apply additive 029 once through the protected path. Compare all old data fingerprints, row counts, balances, references and grants. Stop on any unexplained discrepancy.
5. Merge/release only after mandatory native checks and human GitHub staging gate. Verify exact `/api/release`, new UI asset hashes, health, old/new workflows and row snapshots after delivery.
6. No contract activates by deployment. Owner explicitly prepares each new/amended contract; financial item mappings and final approval remain explicit.

**Recovery:** stop new operational scheduling through the approved feature/configuration path and redeploy the last verified source. Leave additive tables/history intact. Before any new business transactions, the verified encrypted pre-migration backup can be restored to a new isolated target and checked; switching the used database requires a separate explicit owner action. After financial use, preserve posted invoices/receipts and correct through authorized reversals; never restore an old backup over newer transactions or drop financial tables as a shortcut.

No production release, reset, bulk transfer, prior balance/invoice/agreement mutation or user privilege change is authorized or performed by this proposal.
