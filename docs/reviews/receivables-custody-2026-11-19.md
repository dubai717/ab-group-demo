# Customer receivables / custody review

Base: verified live PR107 (`ded568284298aa231cfd5d1a7e93151d56fb1c52`). Protected delivery44553382794 completed with source, Owner, schema, release, smoke and finalize successful; Render deploymentdep-dbvhnt60tbcc73eooeug is live at that commit.

## Reused canonical mechanisms

Original vehicle invoices, finance invoice links/items, financial allocation totals and reversal records; original adjustment/cancellation metadata; original RVs and receipt batches; posted cash custody journals and immutable custody moves; nominated custody routes; partial handover confirmations; deposits and bank posting; original bank-statement matching and approval. No alternative chart, balance table, role or financial subsystem is introduced.

## Change

- Existing financial management gains Customer receivables → Customer balance → Vehicle/item balance → original invoices and linked RVs. Actual records determine company, item and vehicle/service/unallocated grouping. Unlinked historic invoices are displayed without silently classifying them.
- Customer rows aggregate unique source records within each currency. Company breakdowns remain distinct at detail level. Posted invoice allocations, actual cleared RVs and unapplied customer credits are shown separately; outstanding is not reduced twice. Discounts, other adjustments and write-offs remain separate. Cancelled invoices are excluded from totals and retained in history.
- Age buckets use the remaining balance and UAE calendar day: 1–30,31–60,61–90,over90; future and today separate.
- Existing ledger collection function now supports an explicit invoice-selection adapter. One native batch, separate sequentially numbered RV per selected invoice, including two invoices with the same item, across a customer's vehicles within one legal company. Actual cash confirmation is mandatory in this adapter. Invoices remain immutable. Existing item/automatic/Work Amount paths retain their policy.
- Same-key writes serialize before reading their existing response receipt. Native allocation and custody writes serialize without requesting UPDATE on immutable invoices. UI bounds network waits and retains the original uncertain collection payload/key for retry during the session; it never stores customer/financial data in browser storage. After a full browser restart an uncertain payment must be reviewed in the native statement before starting a new collection.
- Handover can nominate specific existing receipt amounts. No movement occurs on request. Recipient moves actual counted funds only; a shortage stays with the sender. Existing routes/receive rights apply; recipient choices show authorized active account names. Original employee/account identity links remain unchanged.
- Pending deposits reserve available custody against other deposit requests; conflicting pending handovers/deposits and duplicate normalized references are rejected. A normal employee cannot verify their own deposit. The existing explicit Owner-controlled verification remains available and audited; no new grants are installed.
- Read-only custody detail exposes the selected holder's original RV/batch lineage. Other holders require the original audit permission.
- Native receipt review checks clean, authorized document bytes. Text PDFs can yield explicitly labelled bank/amount/IBAN/date/reference and differences. Ambiguous/unavailable facts require manual review; extraction never verifies bank receipt. **Image OCR is not installed/configured**; scanned images/PDFs require existing authorized manual verification. No external OCR service receives documents.
- Statement includes native invoices, approved adjustments, RVs, returned-cheque reversal history and linked legacy bank movements without reposting. Opening/running/closing balances remain separated by company/currency. Vehicle/item/document/date/bank filters and private favorite filters are supported, with authorized Excel and print-to-PDF output. Filtered document movements are labelled as such rather than a complete account balance. Historic source completeness is not invented.
- Customer profile financial overview is compact, with outstanding/current/overdue, vehicles with balances, highest balances per company/currency, last two source movements and a context-preserving link to the detailed navigator.

## Boundaries / remaining acceptance

No schema migration or hosted DDL/DML, historical balance/contract rewrite, role/grant change, actual cash test, production deployment, Work Amount or marketing change. No automatic OCR approval or automatic bank feed is claimed. Native manual bank verification and statement reconciliation remain required.

Real authenticated end-to-end Staging acceptance requires the new release and an authorized test session. Isolated fixtures and readonly release smoke do not prove a real hosted cash transfer. No real customer is used for test creation/deletion. Missing bank/image OCR extraction remains an explicit incomplete requirement pending an approved OCR implementation/provider. No sensitive live migration is proposed.

## Validation evidence before PR

TypeScript and JavaScript syntax checks;172 static/deployment-policy checks. Ten new isolated tests cover exact age boundaries, actual PDF extraction/difference detection, same-item independent RVs in one concurrent/replayed collection, partial payment, statement opening/closing, original invoice immutability, selected receipt handover/short count, reserved/partial deposits without another customer receipt, independent verification, unauthorized custody/export, and distinct customer aggregation across two legal companies. Existing ledger/customer suites passed35 tests before the final additional aggregation case; the financial-package/customer/new-cycle group passed20 tests at that revision. Browser runs passed the native ledger and new receivable journeys plus PR106 customer save/recovery and complete customer workspace suites in AR/EN desktop/tablet/phone. Full protected CI remains authoritative for the frozen commit.
