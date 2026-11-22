# E52 — complete scoped exports of six original package registers (BUILD ONLY)

Cost centres, commitments, recurring obligation rules, employee advances, non-sales claims and future discount proposals already had working source/state readers and tables, but those tables had no complete server export source. This was missing export capability, **not a finding of a prior unauthorized export**.

The existing shared financial table now obtains filtered print/Excel/CSV from those same original readers, with strict source/column whitelists and existing company ledger view permission. Every output format additionally requires original `ledger_report` and `ledger_export`, even for empty results. The proposal source retains its original Owner/configuration gate; exporter rights do not confer policy management. No financial source, permission, employee relation or role is created by a report.

Reports include the real selected company and source currency, human localized columns and original state projections. Draft commitments are not accrued liabilities; voucher payment before verified advance delivery is not staff debt. Actual verified repayment reduces the original staff receivable. Supplier cash/bank/payment review states and CPV references come from the original payment projection, not task completion or a new payment calculation. Source limits remain explicit.

The client/server share the same visible-field search projection; action-button text cannot select extra rows on screen that disappear from the export. Per-locale table state preserves AR/EN filters independently. Typed monetary thresholds, version and calendar-anchor fields agree between the client and server. Existing row actions remain bound to their original records. Queries load only the requested original source; no polling or unrelated workbook reload is introduced. Reads allocate no financial document numbers or audit/GL entries.

The shared print adapter accepts localized server labels for additional company columns. Existing reports keep their previous labels and filtering; actual original source regressions were rerun. The inactive proposal register now also shows its configured percentage rather than hiding that part of the proposed rule.

## Acceptance

- **20 final native cases passed**, including three new six-source/output/privacy/601-row cases and original employee advances, eight supplier payment cases, native financial register and output authorization regressions.
- Original advance acceptance explicitly exports Paid-before-delivery with zero debt and `100.001` awaiting verified delivery, then `100.001` actual receivable after verification and `60.000` after actual approved repayment. Original supplier source checks compare new register output throughout its real cash/bank approval, failure/rollback and paid/unpaid transitions.
- **601 original cost-centre records** cross the former first-page/500-row boundaries: 301 filtered active rows and all 601 printed/exported rows, exact selected keys, company metadata, strict technical-column/filter rejection, Excel formula escaping and unchanged source/grants. Empty output still rejects absent export permission and another company.
- Actual Reader/Exporter browser passed full AR/EN print/Excel, real multipage PDFs, search/export parity, three widths and unchanged journals/metadata. Original package, future discount proposals, corporate source workpaper, treasury responsibilities and full ledger-output browsers all passed again.
- Final TypeScript, **172 static tests**, portable runtime build and module graph passed. Logs: `/workspace/ab-test-tmp/package-registers-*`.
- Prior immutable E51 local `b0113fc2707df6b59a8afd8fd8ffb931eb162a33`, remote `094aa087b4d56ff13552df492bc98b9c736a742f`, tree `06c3b18a5221847cad4043f4dee4219537eda0ae` passed **550 cumulative native tests**, tracked source unchanged throughout, log `financial-discount-salik-cumulative.log`. That proof predates these three new cases.

Requirement 9.9 stays partial: fee/entitlement and financial-document metadata exports plus remaining dashboard/drill-down acceptance still need work. No hosted database operation, source migration, balance adjustment, grant change, merge or deployment occurred.
