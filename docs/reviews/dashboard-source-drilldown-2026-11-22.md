# E56 — exact original source dashboard drill-down (BUILD ONLY)

The original financial dashboard counted only Pending vouchers and Review deposits, but opened the unfiltered respective registers. The actual synthetic before-fix browser reproduced **Pending count1 opening2 vouchers**, including an actually cancelled original. No source totals were wrong; navigation omitted the predicate.

The fix reuses original FinancialTables source grids and the same registers/actions/export permissions. Clicking a count selects the exact original status in the current actor/company scope, resets unrelated search/filter/offset, and opens the original list. Clearing filters restores the complete original source. Company/actor groups stay separate; no rows, financial data, grants or parallel ledgers are created. Existing read-only Owner-preview preference guard remains.

## Acceptance

- Actual fixture creates Pending/Cancelled vouchers and Review/Confirmed deposits through original APIs in a fresh isolated DB, with fake bank/Auth/Storage. No live money movement. Owner sees the exact counted subsets; a company-scoped reporter cannot see the Owner's deposit custody and gets the correct empty subset, not another holder/company fallback.
- Full print matches the selected subset, clearing restores all originals, a new count click clears an unrelated old query, another company remains empty and the scoped employee cannot select/read it. Financial source IDs/states and effective rights are unchanged.
- The actual browser passed Arabic/English at desktop/tablet/phone widths. The preliminary after-fix harness was corrected to await original asynchronous preference/navigation completion before counting a newly rendered table; the source assertion remains strict.
- Three related actual browser suites passed again:206-row original document report and delayed type race, original financial package and all five native document types,601-row original register/full print/Excel and actual multipage PDF. Thus **four browser suites** passed for this checkpoint.
- TypeScript, **172 static tests**, portable build and module graph passed. Logs: `/workspace/ab-test-tmp/dashboard-source-*`.

The separate customer test-fixture53100 issue was fixed through immediate own-fixture disposal;8 customer and3 strict disposal cases passed. A new immutable full564 native run follows this checkpoint; the prior563/564 resource-limited attempt is not called a pass. Last complete remote draftCI44982198278 passed on E54, with no deployment.

Requirement9.9 remains partial for remaining new report/source acceptance;9.10 still awaits all95 integration. No hosted migration, financial activation, original DB write, merge or Render deployment.
