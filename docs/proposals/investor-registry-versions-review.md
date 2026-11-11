# Investor registry and versioned agreements — owner review

Status: prepared for review only. The companion SQL is deliberately outside the migration catalog. Neither this proposal nor a code deployment activates the feature: the final schema marker must match `INVESTOR-REGISTRY-REVIEW-1`. Existing behavior remains available without it.

## Concrete sensitive changes requiring approval

The proposal permits an investor profile without an application login or a group company. It relaxes the existing profile login requirement, adds append-only profile revisions, identity links, document links, agreement series/versions/approvals, funding bindings, registration invoice sources, principal releases/reversals and settlements. It preserves existing profiles, encrypted agreement terms, funding records and historical ratios. There is no user creation, role grant, permission backfill, historical balance conversion, deletion or reset.

The existing financing acceptance guard retains its checks. A narrow additional branch allows the owner to accept funding for an independent investor without a login, only with an approved immutable agreement-version binding. Linked investor logins retain their existing response process. New registry writes are owner-only; scoped managers can read permitted operational information, but private identity/bank documents remain restricted. Preview remains read-only on the server.

## Financial decisions to review

* New simplified versions grant a fixed registration share only. The reference fee defaults to AED 300, configurable for future agreements by company/service scope. The investor share cannot exceed that fee. Service fees and other yields are not implicitly granted. Existing historical rights are retained.
* Registration entitlement accrues proportionally to actual collection of an explicitly linked registration invoice, capped at the frozen fixed share. The invoice must match the funding vehicle, company, currency and frozen fee. This avoids treating the fixed share as a rounded percentage of unrelated receipts.
* The current approved version is the latest effective version in its contractual series as of Dubai's current date. Approval rejects conflicting versions with the same effective date. Each version has an independent signed PDF/image. New allocations freeze the version, approval date, company/license, currency and terms. Old allocations never follow subsequent revisions.
* Allocation uses actually approved capital receipts, net documented released principal and existing commitments/reservations/withdrawals. No overdraft override is introduced, including for committed-capital agreements. No backdated new allocation or payout is allowed.
* Capital uses the existing separate liability accounting and actual bank receipts; it is not operating revenue. Recovered principal is displayed separately and becomes reusable only through an explicit documented owner release. A release is not a second bank receipt. Its reversal is append-only and rejected if it would consume reserved/reallocated money. Employee edits/deletes of approved financial movements are denied.
* Withdrawals and returns reuse existing voucher, approval and actual bank-settlement paths. Pending vouchers reserve funds; they are not reported as money already paid. Formal closure requires fully recovered principal and supporting evidence. Corrections do not silently reassign an approved agreement version.

## Activation procedure after explicit approval

Review the companion `investor-registry-versions.review-only.sql`, including RLS and guards. Register only the approved immutable migration/checksum through the existing protected migration process. Rehearse against an isolated restored backup, confirm legacy data and permission invariants, and use the protected owner approval gate before hosted execution. Do not run this file through Render Shell or bypass the migration catalog. The schema marker is installed last so partially applied DDL cannot activate the application routes.

The feature draft is not authorization to apply the financial/schema proposal. Owner approval is required by the requested deployment constraint (section 7.9).

## Verification

The isolated integration scenario covers independent identity and bank data, two signed agreement versions (50 then 100 out of 300), frozen old funding, actual bank capital receipts, duplicate rejection, over-allocation rejection, actual fee/principal collection, release and reversal, settlement, withdrawals/returns, private document access, append-only restrictions and unchanged existing grants. Browser coverage exercises real uploads, red IBAN/share validation, failed read-back retry without duplicate creation, owner approvals, capital and funding forms, and Arabic/English desktop/tablet/mobile layouts. No live investor balances are used by these fixtures.
