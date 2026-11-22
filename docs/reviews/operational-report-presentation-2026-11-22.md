# Original operational report presentation and real PDF — E70

BUILD ONLY. No hosted read/write, financial posting, grants, migration, job activation or deployment.

The existing report API/UI and opt-in human statement projection now also expose original **item profitability, cost-centre result and classified cash-account movements**. They use the same Posted/Approved source rows, amounts, date/company scope and existing export permissions. Legacy responses and conditions without the presentation flag remain unchanged.

- Item result displays the actual registered financial-item name, only when its original company applicability permits it. Missing/inconsistent item references remain a human review caption; another company's name is not revealed. Native record ID/name columns take precedence over encrypted legacy metadata fields. The original unclassified income/expense bucket remains explicit; no financing principal or expense distribution is inferred.
- Cost-centre output retains the name snapshotted at posting, even after catalogue rename/inactivation. Unassigned history is neither removed nor automatically attributed. Net remains original income minus expense.
- Cash-account output retains real JV/bank references, dates, account labels and recorded classification. A bank entry without a recorded cash-flow category stays Unclassified. The caption states that these are classified account movements, not a certified cash-flow statement or proof of customer receipt. Net is labeled movement, not a running balance.
- Original complete filtering, literal-safe CSV/Excel XML and print are reused. New income/expense columns are numeric through explicit projection type metadata shared by server/client. The legacy global field-type rules and saved text conditions are unchanged. Consolidated mode is not falsely claimed for these operational kinds.
- UI, printed headers and file headers agree in the selected locale. Changing inputs/actor/company/locale/filter retains the E66 stale-result/export checks. Opening, filtering and output do not allocate a document number or mutate a source.

## Acceptance

Five new cases; **19/19** related native tests passed, including original statement completeness beyond200 accounts, cost-centre reversal/history, original ledger/export scopes and complete package registers. New cases cover numeric11.002 versus2.001 ordering, exact selected subset files, old text-condition compatibility, frozen centre name, approved bank/native cash references, empty both-company output permissions and foreign-item label denial. Source financial rows and grants compare unchanged.

Actual AR/EN browser passed all three report families at1440/768/390, exact source Excel/CSV, a real numeric income-column filter and **actual PDFs for every family and locale**. Six synthetic PDFs were generated from the original renderer's print frames, excluded from Git. Original statement browser passed again, including held-result/export guards. Original separate reader/exporter ledger browser passed complete invoice output beyond50 visible rows, real multi-page PDF and original dated JV output; no export controls for a reader.

TypeScript,175 static checks and portable build passed. A TypeScript-only empty-map union inference was corrected with an explicit type annotation; runtime source arithmetic did not change. Final merged cumulative acceptance follows.

9.9 remains partial for the remaining report/source acceptance; these three original reports are not all95 acceptance, legal tax treatment, historical matching or release readiness.
