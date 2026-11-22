# Investor agency integration — build only, 21 November 2026

Reused the reviewed PR73 source (`fe99ae49d378c1f2a422845c2cce62b71786a59c`), the original investor profiles/agreement versions/funding sources, invoice allocations, RV/custody/deposits, reconciled bank entries, native PV/cheques and journal reports. No second loan ledger, company revenue assumption, investor guarantee, permission grant or historical adoption was introduced.

## Deployment and financial activation hold

The original 028 proposal is preserved byte-for-byte at `docs/proposals/investor-monthly-028.review-only.sql` (SHA256 `2f997597dfd13540c68f714f191c349e611d7043648871caa4eeefc58938f94c`). It is deliberately outside the approved migration directory and delivery catalog. Protected controllers are unchanged. Tests apply this file only to synthetic local databases. Hosted activation still requires explicit financial migration approval, current backup/rehearsal and final protected package acceptance. These are development results, not Staging activation evidence.

## Accepted behavior in isolated fixtures

- 3,000 capital received, 2,000 actually funded: unused capital remains 1,000; investor-owned customer rights are subledger rights, not company assets/income.
- 1,250 installment plus 300 registration fee under the frozen 150/150 split: investor liability 1,400, company income 150. No new principal recycling or company default guarantee.
- A matching amount alone cannot classify a service as registration: the original documented registration source is required.
- Only actual bank credits covered by an approved reconciliation enter monthly settlement. Preparing/signing/approving a cheque does not mark it paid. Duplicate source intervals, active settlements and native vouchers are rejected.
- Scoped collectors see original financier name/number in original customer statements; private investor banking/identity fields remain unavailable. New authorized funding freezes only a safe display caption; historical records are not silently modified.
- New investor numbers use the native counter and immutable profile identity; existing numbers are retained. No Auth accounts or rights are created as a side effect.
- Company receivables and investor-managed rights are reported separately. An Owner correction to managed rights does not create company expense or fake receipt; ordinary authorized company discounts retain their existing behavior.
- Dedicated agency liability accounts cannot be reused for Owner/card debt, VAT, customer credit or ordinary item roles. Native PV provenance must match the reviewed original settlement.
- Actual browser acceptance covers eight Owner metrics, source preview, native PV, false-paid rejection, Excel, real Chromium PDF, bilingual layouts and desktop/tablet/mobile.

```mermaid
flowchart LR
  A[Original investor capital] --> B[Actual bank funding]
  B --> C[Customer rights: managed subledger]
  C --> D[Original RV and staff custody]
  D --> E[Confirmed handover and bank deposit]
  E --> F[Approved bank reconciliation]
  F --> G[Monthly original-source settlement]
  G --> H[Native PV and actual bank payment]
```

Test evidence is in `backend/tests/investor-monthly-*.test.ts`, `investor-monthly.browser.cjs`, `investor-profile-number.test.ts` and `contract-financier.test.ts`. Preservation includes populated legacy rows, immutable agreement versions, private attachment bytes, original ACLs and a restore to a separate synthetic target. No original Supabase/Render writes were performed.

## Local test resource correction

The test setup now disposes only `ab_backup_<random UUID>` databases it created in its own process on the validated loopback test cluster. Restore tests separately dispose their own newly created `ab_restore_<random UUID>` copies after closing pools. No FORCE, no unknown database cleanup, no production/source restore and no deletion of backup artifacts. A child-process acceptance test verifies process exit cleanup. Five retired restore copies were separately identified by exact synthetic tenant/Owner markers and no active sessions before local cleanup; original application databases were excluded.
