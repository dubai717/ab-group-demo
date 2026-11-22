# Original group statement presentation and cross-flow acceptance — E66

Build only. No hosted database, migration, grant, balance, deployment, tax election, elimination policy, Work Amount or operating contract changes.

## Existing source reused

The original trial/balance/profit report already aggregated native Posted journals and Approved bank operations, authorized every selected company and applied the configured balanced reciprocal-account elimination policy. Its UI did not submit `consolidated`; default statement rows/files exposed chart/company IDs. This package adds an opt-in `human_statement_v1` projection and connects the existing company checkboxes to the original group flag. Legacy JSON/files without the flag retain their shape.

Human rows contain actual company/account names, account number/type, currency and original debit/credit/net. Derived current earnings is identified as a derived posted result, not assigned a fictional account number. No account is created by reading. Unbalanced reciprocal accounts remain visibly marked and the output filename says group-review-required. Matched balances retain the original elimination rule; no new transaction-matching rule is imposed.

The existing register filter and literal-safe CSV/Excel XML writer are reused. Filters operate on visible columns, including an empty source. Files/print include the whole authorized filtered source beyond 200 rows; ordinary legacy JSON pagination remains. Output still requires original report/export authority for every company. The selected-row subtotal is identified separately from financial closing/tax certification.

## UI consistency

The report reuses the existing form/company selection and brown design. Group view selects permitted active companies, while the server independently enforces its existing all-active-company scope. Changing inputs invalidates the result. Company selection survives locale rerender. Locale, input revision, actor, company and register-filter changes invalidate held responses and exports; no automatic polling or financial mutation was added. Empty company selection produces a meaningful error and retains the form.

## Acceptance

- Four new native presentation cases: original balances/filters and literal-safe multilingual files; 206-account complete output; both-company report/export permissions and empty-source column validation; original unbalanced/matched reciprocal transition with unchanged posting snapshots.
- Three cross-flow native cases: Owner card liability38 / business expense13 / wallet20 / customer AR5 / personal2 excluded; staff advance100.001 delivered and40.001 approved repayment leaves60 receivable without sales; investor unused capital1000 and collected liability1400 remain external obligations, bank assets2550 and actual company income150, no uncollected principal booked as company AR.
- Final related native acceptance: **11/11**, zero failures/skips, including existing shared settlement source output. Original Owner and investor tests initially used incorrect test assumptions (generated account number; bank chart has kind bank), corrected to native recorded account identity and asset/bank classification. Source arithmetic and journal snapshots were not weakened.
- Actual AR/EN browser passed exact downloaded Excel, two-company selection, three widths, held real report response while editing, and held real CSV export while editing. No stale result/download occurred. Native fixtures use random local PostgreSQL databases and fake Auth/objects/scanner; no cash transfer or hosted API.
- TypeScript, **175 static checks**, portable build passed. Full merged-source acceptance follows the saved checkpoint; no all-95 or release claim.

## Remaining

This is a read presentation, not a certified group financial close, tax return, FX consolidation or historical matching. Requirements1.3/9.4/9.9/9.10 remain partial pending complete workflow/closing acceptance and final integration. All financial/legal decisions and hosted activation gates remain.
