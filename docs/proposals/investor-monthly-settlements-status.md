# Monthly investor settlement — isolated work in progress

This branch is **not approved for hosted migration or financial publication**. It is independent of the safe dual-list permissions UI in PR #71. Its review-only SQL is deliberately outside `supabase/additive` and the protected migration catalog. No existing agreement, financial balance, journal, permission or secret is changed by this work.

## Implemented and checked in isolation

- Proposed empty monthly configuration/version/classification/settlement/source/exclusion structures, owner RLS, immutable history, unique active investor/company/currency/month and allocation/bank-entry claims. New configuration bindings accept newly created versions only; old versions are not converted.
- Proposed source/reversal guards retain referenced reconciliations, receipts and allocation history. These guards are additional triggers and therefore require explicit financial migration approval before any hosted application.
- Pure planning tests: full installment belongs to investor, registration shares preserve frozen 50/100/150 terms, pending/unmatched deposits are excluded, original receipt dates survive carry-forward, company/currency mixing and repeated claims fail, reserved/paid sources cannot be selected again.
- Isolated schema rollback, preservation of all pre-existing table rows/functions, owner/employee/company scope and revoked grant checks; encrypted backup/restore drill checks rows and private object bytes.
- Initial posting integration is written and type-checked; **not an end-to-end financial acceptance result**.

## Current evidence

2026-11-12 isolated checks: 347/347 backend regression cases passed; after the final scope/uniqueness assertions, all 7 monthly planning/schema cases passed again. TypeScript, source integrity and application build passed. These counts establish legacy compatibility and tested draft invariants, **not acceptance of the unfinished monthly lifecycle**. No hosted financial fixtures or migration ran.

## Unfinished acceptance work

The source loader from actual receipt/custody/deposit/approved statement records, accounting configuration review, agreement opt-in, authenticated monthly lifecycle endpoints, original voucher/cheque guards, actual bank-debit finalization, owner dashboard, PDF/Excel exports and browser/accessibility tests remain unfinished. Credit applications, operational invoice adjustments and closing/reports require explicit new-policy treatment and integration tests. No current version fields expose this draft policy. Future source loading must use immutable posting snapshots and sequential receipt numbers rather than reordering registration shares by an editable/backdated receipt date.

Proposed accounting (requires owner review): investor-owned agency funds use separate capital-custody and collected-payable liabilities; gross installments are recognized on actual collection, not company operating income. Registration income is only the company's frozen share; cash handover and bank deposit must not recognize a second liability. Legacy agreements keep their original treatment. Tax-bearing cases require separate reviewed mappings.

Do not request final financial activation approval until the complete workflow and preservation tests pass. At that point present the exact migration checksum and source SHA, accounting mapping and impact, a fresh encrypted backup plus verified isolated restore, preservation checks and protected staging rollback plan. Never reset/delete data or downgrade the hosted schema to roll back: disable new entry points and restore a known application release; any database recovery must be a separately controlled backup restoration with preservation validation.
