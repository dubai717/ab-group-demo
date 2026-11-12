# Monthly investor settlement — isolated work in progress

This branch is **not approved for hosted migration or financial publication**. It is independent of the safe dual-list permissions UI in PR #71. Its review-only SQL is deliberately outside `supabase/additive` and the protected migration catalog. No existing agreement, financial balance, journal, permission or secret is changed by this work.

## Implemented and checked in isolation

- Proposed empty monthly configuration/version/classification/settlement/source/exclusion structures, owner RLS, immutable history, unique active investor/company/currency/month and allocation/bank-entry claims. New configuration bindings accept newly created versions only; old versions are not converted.
- Proposed source/reversal guards retain referenced reconciliations, receipts and allocation history. These guards are additional triggers and therefore require explicit financial migration approval before any hosted application.
- Pure planning tests: full installment belongs to investor, registration shares preserve frozen 50/100/150 terms, pending/unmatched deposits are excluded, original receipt dates survive carry-forward, company/currency mixing and repeated claims fail, reserved/paid sources cannot be selected again.
- Isolated schema rollback, preservation of all pre-existing table rows/functions, owner/employee/company scope and revoked grant checks; encrypted backup/restore drill checks rows and private object bytes.
- Initial posting integration, actual receipt/deposit/approved-statement source loading, owner-only draft/review/one-voucher preparation/cancellation and Excel/print data export are implemented in this isolated branch. An actual cash collection, deposit, statement matching/approval, 1400 payable, duplicate source exclusion, one voucher/cheque, unconfirmed payment refusal and cancellation release passed integration testing. **This is not full financial acceptance or authorization to publish.**

## Current evidence

2026-11-12 isolated checks: 348/348 backend regression cases passed, including 8 monthly prototype cases. After the final source-classification guard changes, the actual collection/lifecycle and schema/preservation cases both passed again. TypeScript, source integrity and application build passed. These counts establish legacy compatibility and tested draft invariants, **not acceptance of the unfinished monthly lifecycle**. No hosted financial fixtures or migration ran.

## Unfinished acceptance work

Accounting configuration review and safe multi-investor control mappings, agreement opt-in, full actual bank-debit finalization acceptance, owner dashboard, frontend PDF/Excel exports and browser/accessibility tests remain unfinished. Transfer/incoming-cheque and scoped employee collections need integration coverage. The cash test covers ordered partial-registration reversal refusal and exact thousandth rounding. Credit applications for newly classified invoices are explicitly blocked until original bank-source tracing is implemented. Operational invoice adjustments and closing/reports need new-policy integration coverage. Evidence withdrawal after source claiming also needs acceptance checks. No current version fields expose this draft policy. Future source loading must use immutable posting snapshots and sequential receipt numbers rather than reordering registration shares by an editable/backdated receipt date.

Proposed accounting (requires owner review): investor-owned agency funds use separate capital-custody and collected-payable liabilities; gross installments are recognized on actual collection, not company operating income. Registration income is only the company's frozen share; cash handover and bank deposit must not recognize a second liability. Legacy agreements keep their original treatment. Tax-bearing cases require separate reviewed mappings.

The owner was asked to clarify whether the legal/accounting relationship is investor-owned agency funding or a borrowing owed by the company. The illustrated agency model is provisional; this decision must be resolved before finalizing mappings and activation.

Do not request final financial activation approval until the complete workflow and preservation tests pass. At that point present the exact migration checksum and source SHA, accounting mapping and impact, a fresh encrypted backup plus verified isolated restore, preservation checks and protected staging rollback plan. Never reset/delete data or downgrade the hosted schema to roll back: disable new entry points and restore a known application release; any database recovery must be a separately controlled backup restoration with preservation validation.
