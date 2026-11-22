# E48 — original treasury responsibility overview (BUILD ONLY)

A current read-only view in the existing financial workspace now joins original fund ledgers, receipt custody, handovers, deposits, outgoing cheques, employee advances and Owner reimbursement/cheque responsibilities. It creates no parallel ledger, task, role or financial transaction. Reads allocate no document numbers; existing RV/PV/Deposit numbering is reused.

Cash fund ledger balances, actual collected cash, incoming cheques, pending proposals, staff receivables and Owner requests have different meanings. They remain separate by company, kind, basis and currency, with **no combined cash total**. A fund ledger is not a physical cash count. A pending permanent-fund handover is not received money. A cheque register is not proof of employee possession or cleared cash. Accepted handovers/confirmed deposits have historical face/actual amounts and zero new current custody; the original custody moves remain authoritative. Partial receipt leaves the difference with the sender. Partial verified deposit lowers custody only by its actual confirmed amount.

Existing original company/source permissions are retained independently. An ordinary report reader sees their own funds, collection custody and linked staff debt, not coworkers' records. Fund management does not grant collection audit. Only original Owner settlement authority exposes full reimbursement requests. A delegate sees their own cheque responsibility without private card/bank details. Cancellation of the associated voucher does not erase a held cheque; actual return and Owner confirmation close that responsibility. Reissue history remains distinguishable. Original staff AR reconciliation is flagged rather than repaired or hidden. Partial actual repayment and full repayment produce the original remaining debt, never cash custody.

Owner company reimbursement accounting closure is separate from verification of personal issuer payment. Current open administrative follow-up can have zero new cash. Neither a requested amount nor a closed cheque certifies total Owner GL payable or personal card payment. This is a **current snapshot**, not reconstruction of historical custody snapshots; original dated ledger/statement reports remain separate.

The API bounds source sizes and batches queries. Output requires original company report/export permissions even when empty. It rejects technical columns and unsupported historical ranges. The existing table supports complete filtered Excel/print, original source drill-down, AR/EN and three widths. Opening/refreshing it does not poll or reload unrelated workbooks. Locale-specific column state avoids stale Arabic column filters changing English output.

Actual browser testing caught a new-tab preference whitelist failure; the real server preference enum was corrected. Navigation now captures actual tab keys before later field-label augmentation, removing phantom field-label tabs without removing real tabs or changing grants.

## Acceptance

- **39 native cases passed**: three new source/scope/reissue/repayment cases, plus original Owner settlements, permanent fund handover, employee advances, native ledger, register and fund privacy regressions.
- The original full Owner case proves company accounting closure before personal issuer payment verification; original fund case proves pending 500 is not cash and actual remaining petty balance is 450 after confirmed receipt and approved expense.
- Actual overview browser passed full authorized output, human references, own-reader privacy, no financial writes, no polling/unrelated reload, no phantom tabs and AR/EN at 1440/768/390.
- Actual corporate source browser passed again after locale-scope integration. Original package and full ledger-output regression browsers also passed in a serial fixture run. An earlier overlapped harness invocation was discarded and rerun serially; it is not a product failure or acceptance result.
- TypeScript, 172 static tests and portable runtime build passed. Logs under `/workspace/ab-test-tmp/treasury-overview-*` contain synthetic data only.
- Exact preceding E47 local `f1ca0af925e5ece7f77e66e8955d916af7a7ba80`, remote `844d180393495673c549b96266d85c2f0404a6ad`, tree `4299cae8afdb39cd196806246b3f39f97f41cf06` passed **536 cumulative native tests with tracked source unchanged**. Its draft CI44970692562 concluded cancelled; no protected operation or cancellation was initiated here. E46 draft CI44968684100 succeeded.

Requirement 9.7 is complete in the build branch, not published. Broad 9.9/all95 acceptance remains partial. No hosted database operation, grant change, balance adoption, merge or deployment occurred.
