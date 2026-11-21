# Non-sales manual claims — build only, 21 November 2026

Extends the original journal, numbered RV, custody move and handover engines. No invented customer, employee sales invoice, separate monetary ledger, role or grant. Existing customer/driver service claims retain their original invoices; employee advances retain their separate signed-delivery workflow.

## Implemented and accepted in isolation

- Documentary claims against an existing employee identity or an explicitly named external party. Unique original reference reserves a draft idempotently; changing its amount cannot silently reuse that reference.
- Saving a draft has no financial effect. Actual Owner approval posts the original balanced journal to a dedicated receivable asset and an expressly reviewed non-sales recovery counterpart. Sales revenue is not an accepted counterpart. Historical account balances cannot be adopted into a new claim.
- Actual posted entries and reversals determine outstanding balances. The register batches all source balances in one query instead of issuing one query per claim.
- Partial cash collection uses a unique original RV, original `receipt:<id>` journal and original collector custody moves. It never changes the original charge, creates a zero RV or marks a promise paid. A retried reference returns its existing RV; changed claim/amount is rejected.
- Native independently accepted partial handover transfers only the amount counted: 25.001 offered / 20.001 accepted leaves 5.000 with the original collector. The claim balance does not change again.
- No self approval/collection of an employee's own claim; Owner and company scope checks are server enforced. Cancellation of an unpaid approved claim uses the original reversal journal; a claim with RVs requires a documented correction workflow.
- Actual browser acceptance: create, approve, reject overcollection without losing inputs, correct and save partial receipt, close form, refresh balance, open original RV numbers from row detail; Arabic/English, desktop/tablet/mobile.

## Guard extension is NOT activated

The current original custody guard intentionally excludes general receipts with no customer sales item. It was not bypassed or weakened in application code. Cash collection fails closed with `claimCustodySchemaReviewRequired` before writing any RV unless the reviewed version marker is present.

`docs/proposals/manual-claim-receipts.review-only.sql` is outside the delivery catalog and migration directories. It checks the exact original guard before DDL, adds an immutable source link to the **original** RV and reviewed original claim journal, checks source amount/party/company/account, and retains the original nonnegative/per-receipt custody limits. General receipts without that verified source remain excluded. Existing customer receipts retain their protection. The proposal has only been applied to synthetic local test databases. Any hosted application requires specific financial migration approval and rehearsal; no original Supabase state has been changed.

## Evidence and remaining work

`manual-receivable-claims.test.ts`: three integration cases include retries, partial receipts/handover, company/self/Owner denial, no invented customers/invoices, unchanged grants, native reversals, schema hold, unexpected original guard rejection and immutable receipt source. `manual-claims.browser.cjs` is the real UI flow. Related wallet and original vehicle-bank integration regression passed in a 17-case targeted run after correcting a misplaced development guard edit.

Requirements 4.5 and 4.7 remain **partial**: unified collection assignment/contact chains and party-separated productivity/report exports are next. Approved bank/payroll recovery, documented correction of collected claims and broader acceptance remain incomplete. No hosted release or financial activation is claimed.
