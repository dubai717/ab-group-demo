# Ledger output authorization and complete printing — E45

Build only. No hosted data, grant, role/action catalog, deployment gate, financial policy, journal or invoice was changed by output.

## Reproduced causes

`ledger-output-before-fix.log` reproduced both faults in random isolated databases:

1. A company ledger reader/reporter without export authority could call the ordinary report `format=print` path (200 instead of 403).
2. A user explicitly authorized to export the ledger could not print the original register: it required `ledger_print`, an action absent from the actual ledger action catalog (403 instead of 200).

The ledger uses the existing **`ledger_export`** authority for its PDF/print output, as for Excel. No invented grant, new action or automatic role migration was added. Bank `finance_print`, customer printing and vehicle printing remain separate existing controls. Bank-print authority alone does not authorize ledger output.

## Original paths reused

- Original ledger registers/reports, customer receivables/statements, VAT workpaper, Owner report and investor settlement output now use their existing ledger export gate. Their report/view, company, customer, bank, investor and Owner-only checks remain.
- An empty customer statement retains its selected authorized companies and checks their output authority too. Absence of rows cannot bypass the output gate.
- Actual report company names and original JV numbers/references are exposed as additive read metadata. Searchable `JV-…` references and default journal/ledger output avoid raw internal UUIDs. No new financial document number is allocated by reading or printing.
- The ordinary report print action requests the complete **server-authorized current filter** and uses the existing shared `RegisterExport` renderer, rather than printing only the 50 visible rows. The caption preserves company/date scope, source limitations, unclassified invoices and unposted-adjustment counts; it does not certify a closing or tax return.
- Shared register printing uses existing localized visible headers/value formatting. Excel keeps the original numeric/source data. Actor, scope and filter changes invalidate pending output; no stale response is exported to a different view.
- The standard `date` key has the same date type in client and server filtering. The existing matching-day result is preserved; malformed calendar dates are rejected instead of silently treated as text.

## Accepted tests

- Three new native cases: no export means no ledger print/Excel/CSV (including empty statements); explicit company exporter prints/exports original registers, receivables, statements and VAT while other companies and the private Owner report remain denied; date-filtered print/Excel and original JV search agree and reject 30 February. Financial entries and grants compare unchanged.
- **62 related native tests passed**, including complete-register boundaries, receivables/RV/custody/deposit cycle, cash role/scope guards, commitments' existing journal sources, petty handover, non-sales bank receipt/task linkage and VAT workpaper.
- Actual separate reader/exporter browser passed. Reader sees no output controls. Exporter prints the complete invoice source beyond 50 visible rows with localized headers; a real **multi-page PDF** was produced from the original rendered print frame. Main journal printing is complete in AR/EN, uses real company/JV labels and source warnings, and preserves all journal IDs. Actual date-column filtering and downloaded Excel agree with the filtered print source; desktop/tablet/phone layout passed.
- TypeScript, all **172 static/regression checks**, and portable runtime graph build passed. The final broader frozen-source cumulative run follows the saved checkpoint; earlier acceptance is not relabeled as this commit.
- The PDF/XML artifacts are synthetic local `work/` files, excluded from Git, not backups or hosted financial documents.

## Checklist re-evaluation and limits

Requirement **7.1** had an outdated note: its allegedly missing unbilled-customer handling and complete independent settlement were already accepted in E34/E40. Explicit personal ownership and business/customer/personal use separation are complete in the unpublished build; historical ambiguity is not automatically reclassified. This is reuse of completed work, not another implementation. Requirement 7.3 still lacks broader classification/refund acceptance, although issuer-payment matching itself is accepted.

The broader 9.9 requirement remains partial: all new module drilldowns/exports and all-95 acceptance are not inferred from this output fix. No e-invoice provider compliance, tax filing, actual TRN certification, hosted schema activation or deployment is claimed.
