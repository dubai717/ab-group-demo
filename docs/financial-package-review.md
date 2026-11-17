# Financial package: review and activation boundary

Base: `1566770424ae1df10c47b343b46e32a38eef083c` (merged PR #99).
Repository: `dubai717/ab-group-demo`. Delivery target: staging only.

## Existing engines reused

`ledger.ts`, `ledger-domain.ts`, `finance.ts`, the existing financial worker,
`finance_items`, invoice links/adjustments, receipts/allocations, vouchers,
deposits, operations, funds, journals/entries, document evidence and finance
events remain authoritative. There is no second monetary ledger. Encrypted
`ab.settings` records store definitions, approval boundaries, versions and
document presentation metadata; native financial rows still determine money.
Native transaction/RLS/idempotency/company checks surround the new routes.

The five-document register reads native Invoice, RV, Discount, PV and Deposit
records. One multi-invoice discount has one header and its original allocation
rows. Cash-fund payment journals and standalone bank payment operations appear
as PV sources without creating a second expense, voucher or journal. Bank
operations already linked to a voucher are excluded from that second source.
Paging is server-side (100); invoice financial balances are queried for only
the current page. Historical document numbers are not rewritten.

## Precise legacy semantics

* **Priority** is ascending numeric order, used both to sort invoice dues and
  to allocate eligible automatic collections. Existing manual allocation can
  require an authorized priority override and reason. It is not merely a
  display order. This package does not update historical numeric values or
  reallocate any old receipt. New proposed ordering is stored separately and
  has no financial effect without specific approval. Once separately approved,
  a disabled policy requires explicit invoice allocation. Contract/vehicle,
  corporate and Work Amount collection paths retain their native rules.
* The old general recurring worker selects configured active automatic items
  and eligible active/pending vehicles with active customers. Monthly means
  first-of-month dates from the current month through December. A December
  run prepares the following year. Annual uses one chosen month, on its first
  day. Native source keys deduplicate reruns. Protected contractual categories
  continue through their own existing generators.
* **annualMonth = 0** substitutes the vehicle registration **month**, not its
  full registration day. For example, registration on 17 March selects 1 March;
  an invoice before the actual registration date is skipped. Nonzero 1–12
  selects a calendar month. It influences issuance/due dates in that legacy
  worker; it is not a contract term or number of installments. Historical
  annualMonth/recurrenceStart and existing contractual schedules are preserved.

New definitions have an explicit entitlement binding: saving an item alone
creates no invoice. None/monthly/annual require an evidenced, scoped customer
relationship, dates and amount; contract recurrence cannot use this generic
generator. Monthly calendar-day proration is explicit, not assumed. End dates
and disabled relationships prevent future issuance; historical invoices stay.
No bulk conversion of old item definitions is performed.

## Item and document changes

New item codes are generated from the native counter, seeded above existing
FI numeric codes; existing codes are immutable. Daily item forms hide technical
codes/priority, show bilingual financial classifications and collection/payment
flags, and collapse accounting settings. A scoped approved item can supply an
account-mapping template. Active account/company/type validation remains on the
server; principal and managed funds cannot be casually mapped as company income.

Document numbers and actors are server-assigned. Invoice balances distinguish
cash collected, credits, legal outstanding and accounting outstanding. Discount
uses the native noncash credit engine and never creates RV. Future unearned
invoice cancellation is allowed only when fully uncollected/uncredited and
unwritten-off, with reason, confirmation and financial activation. Bad debt is
a separate approved expense/receivable journal and accounting writeoff; it does
not silently waive the legal debt or charge third-party/investor funds.

RV/PV/Deposit/Discount have no new Cancel action. Annotation/correction history
is audited, with optional reference to a real posted correction journal.
Confirmed/posted money is never rewritten by this presentation correction.
Pending deposit edits additionally require specific financial activation and
recheck evidence, custody, bank, currency, digest and company. Paid PVs are not
editable. No cheque or payment is executed by saving these forms.

## Administrative noncompliance fees

Rules are disabled on creation. They require original item, separate income fee
item/account, legal-company scope, prospective effective date, clean contractual
evidence, delay in calendar months, amount, once/monthly recurrence, and an
explicit calculation unit (one customer/item balance or each original invoice).
The default unit is customer/item; the UI never silently charges each violation.
Preview shows origins, balance, period and effect without posting.

Only approved active rules can issue native invoices. Eligibility uses the real
due date, unpaid balance and approved prospective boundary. Fully paid or
written-off originals, unallocated customer credits requiring reconciliation,
foreign company/currency and fee-on-fee compounding are excluded. Unique source
keys prevent duplicate fees for a unit/period; version changes are prospective
and do not edit old invoices. Disabling stops new issuance and keeps history.

## Work Amount: review only, limitations

The current `/api/ledger/work-amount` path is for an individual customer and a
manual cheque collection. It rejects a contracting-company party. It validates
liability mappings, creates the native work invoice, receipt batch, pending
voucher and link, and returns `bankCleared: false`. Idempotency and existing
tests cover duplicates and clearing; a saved voucher is not actual cash payment.

This path does **not** establish the complete business flow described by the
owner: a contracting-company/work-contract link and automatic calculation of
gross work proceeds minus actual expenses into the customer's net entitlement
are not established here. The amount is supplied explicitly. These gaps are
reported for a later decision, not implemented in this package. Its existing
commission branch, accounts and financial algorithm are unchanged. The shared
collector explicitly retains legacy policy for this path, insulating it from
the separately proposed new allocation policy.

Business sourcing, marketing/sourcing commissions, contracting-company contract
terms and operational entitlement distribution are outside this change.

## Sensitive approvals and rollback

Normal deployment adds code, UI and encrypted configuration support, **no SQL
migration and no live financial activation**. It does not alter existing
balances, users, roles, documents or historical contracts.

`financial-package-v1:approval:<company UUID>` must be separately reviewed for
each company and feature (`priority`, `recurring`, `fees`, `documents`). Runtime
requires an active owner approver, reviewed digest, date and reason. There is
deliberately no API in this package that installs this financial approval.
Actual allocation changes, recurring/fee issuance, Cancel/BadDebt and financial
draft amendments therefore remain gated. Rule activation also requires the
owner. A GitHub deployment approval does not substitute for this approval.

The additional PV draft-amount capability needs the narrow guard proposal in
`proposals/financial-pv-draft-guard.sql.txt`. This file is **not** an automatic
migration. Until specifically reviewed/applied, API amendment fails closed with
`pvDraftGuardReviewRequired`. The exception permits only new marked manual PVs
still Pending, without cheque/bank/posted accrual, same identity/company/actor,
and revision increment, inside an owner-authorized transaction. Existing guard
logic remains the fallback. Its paired rollback restores the exact prior
function, not previous data values; legitimate approved amendments are not
silently reverted. Neither script modifies balances, roles or original rows.

Both replacement and rollback were executed only in a newly-created isolated
database. Before any future staging application: obtain specific approval,
take and restore-verify a fresh encrypted backup, compare financial/permission
invariants, apply only the reviewed proposal, and stop on any unexplained change.
These steps are not performed against staging by this package.

Delivery must use the existing protected controller. A newer protected run may
retire an old waiting run only under the trusted supersession predicate, before
schema/release starts. Do not approve the old delivery, disable protections,
modify secrets, or treat a merge as a deployed Render version.
