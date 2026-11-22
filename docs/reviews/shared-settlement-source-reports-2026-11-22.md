# Original shared settlement source statement — build only

The original shared commitment now has a read-only source statement using the existing FinancialTables search, filters, paging, row-open, Excel and print/PDF renderer. It reads its saved source links and native approved bank entries. It creates no invoice, receipt, journal, new elimination rule or report-specific balance store.

The original share appears once in the summary. Each historical row preserves its own amount/status; rejected/draft rows contribute **zero** actual paid/received. Separate selected totals cover approved payouts, approved receipts and payouts awaiting a receipt. Full-source remaining payable and receivable stay separate from filtered row totals. An approved bank payout is never inferred to be the other company's receipt. Effective payment/receipt dates come from the actual native bank operations; source-link creation day is displayed in UAE time.

JSON, search, typed numeric/date filters, sorting, print, CSV and Excel use the same bounded source, allowlisted human fields and exact selected order. Original encrypted metadata, document contents, grants and personal data are not exported. Spreadsheet formula-like references remain literal. An old/current party/company name is not used to guess a new financial relationship.

## Authority and stale output

Both companies require their original ledger view/intercompany/report and bank view/finance view for the source statement. Any output additionally requires ledger export for both; Excel/CSV need their original finance export and print/PDF their original finance print. An empty statement does not bypass these checks. Original source-only commitment readers do not receive bank settlement metadata or output actions.

The shared FinancialTables opt-in `current` predicate was already checked for an asynchronous source refresh, but not export. It now also runs **before the output request and after its response**. Existing callers without that optional predicate keep their behavior; callers with it cannot export a still-open stale company/actor/locale record. Server authority remains mandatory. This does not alter grants or expose new public endpoints.

## Acceptance

- Four new native cases passed: exact actual/rejected/draft accounting; original and selected totals; numeric/date/search parity across JSON/print/Excel/CSV; literal spreadsheet references; all output checks including empty rows and both-company bank/ledger scopes; no source/grant mutation.
- Twelve final native cases passed including the original settlement source/approval controls and ledger output authorization.
- Consolidation regression preserves the existing explicitly configured **reciprocal-balance** policy. While20.000AED is paid but not yet received, the original consolidated trial refuses elimination of unbalanced reciprocal accounts. Matching actual receipt restores its original elimination behavior. Supplier expense remains100.001AED exactly once; internal movements create no income or customer invoices. This test does **not** impose a new individual-transaction matching policy on historical Owner-approved elimination accounts.
- New actual browser suite passed for Owner, reporter and exporter, AR/EN at1440/768/390, search/row-open, exact selected print and Excel, and an actual synthetic PDF. A held output response followed by switching company produces no download; another click in the stale record sends no output request. Source-only reporting lacks export buttons and server permission checks remain independent.
- Three existing browser regressions passed:206-row original financial documents, original financial package and actual two-sided shared settlement/503-after-server-commit recovery.
- Final TypeScript,172 static cases and portable build/module graph passed. Logs `/workspace/ab-test-tmp/shared-settlement-report-*`. Frozen cumulative **577/577 passed**,0 failed/skipped,925574ms, local `e9571f66cb44a3ffec01553f03a76aec0abb2948`, exact tree `828e2f1961014b5283fd359711de28f43ff634eb`; no tracked edits during the run. Log `/workspace/ab-test-tmp/financial-shared-source-report-cumulative.log`. E58 exact tree separately passed573/573.

All95 requirements remain incomplete. Shared VAT/recovery/recharge decisions, investor/legacy financial adoption, legal tax identity/profile/provider validation and Owner-personal accounting/independent approval decisions are not guessed. No original Supabase write, historical migration, operating Reset/Restore, permission change, staging merge, protected approval/dispatch, Render change or Production operation.
