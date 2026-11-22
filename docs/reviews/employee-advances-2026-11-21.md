# Employee advances — finance completion build

Reuses the personnel employee/assignment registry, native asset accounts, payment vouchers, cheque approval and bank settlement. It does not create a customer, sales invoice or customer receipt.

## Accounting and control

1. Request and independent approval are nonposting records. A signed/scanned supporting document and active in-scope employee are required.
2. Company configuration selects an existing payment item and two dedicated nonbank asset accounts: paid advances awaiting delivery, and staff receivables. These accounts cannot be the customer AR, customer custody, cheque transit or cash fund accounts. Once reserved, new fund, custody-configuration and customer-invoice mappings cannot reuse them. Existing chart balances and grants are not modified.
3. The native payment voucher suppresses expense accrual and uses the pending-advance asset as its settlement counterpart. Approval alone books neither expense nor employee debt. Actual bank settlement posts debit pending advance / credit bank.
4. An independent authorized reviewer verifies actual delivery and signed employee acknowledgment. The amount must match the paid voucher. One balanced journal moves pending advance to staff receivable. The employee cannot approve or verify their own advance.
5. Recovery links an already approved bank receipt tagged with the employee reference, or the existing posted payroll journal for that employee. The source must credit the exact staff receivable account and belong to the same company/currency. Reserved allocations cannot exceed the source credit or the advance balance. A repeated allocation is idempotent; no second cash, income or salary journal is created.
6. Payroll remains subject to its existing evidence, legal-basis, independently approved deduction and explicitly configured legal-limit controls. The new feature neither creates salary deductions automatically nor changes legal limits.
7. The report reconciles attributed outstanding advances with posted ledger balances. An unallocated payroll credit or other ledger discrepancy remains visible for review. Paid funds awaiting signed delivery remain separate from employee debt.
8. Requested/unpaid records may be cancelled with an audit reason after native voucher cancellation. Paid/delivered advances cannot be erased; repayment and authorized correction controls remain necessary.

```mermaid
flowchart LR
 Request[Advance request / no posting] --> Review[Independent approval]
 Review --> PV[Native payment request]
 PV --> Bank[Actual bank payment]
 Bank --> Pending[Paid advance awaiting delivery / asset]
 Pending --> Proof[Independent signed delivery review]
 Proof --> Staff[Staff receivable / asset]
 Staff --> Source[Approved bank receipt or payroll credit]
 Source --> Link[Reserve source allocation / no duplicate entry]
 Link --> Match[Reconcile staff balance to posted ledger]
```

## Verification and limits

Isolated tests verify no expense/sales invoice on an advance, native payment approval and clearing, exact and concurrent delivery, partial bank recovery, approved payroll deduction recovery, no duplicate postings, reserved-account separation, unauthorized access, cross-company rejection and unchanged grants. The real completion browser verifies configuration, employee selection, request, approval, native payment, signed delivery, recovery and readback in Arabic/English on desktop/tablet/mobile. Its fixture is independent from the original package suite and production rate limits are unchanged.

No Original Supabase writes, deployment, schema migration, historical advance backfill or automatic payroll deduction occurred. Cash advances and recovery now use the existing cash fund and native PV/general RV records, with no customer or sales item assigned to the staff receipt. Signed actual delivery and repayment require an independent authorized cash-fund holder; fund spending/refill rows serialize against those actions. Requests exceeding available cash or staff debt are rejected. Exceptional debt waivers remain a separate legal decision and are not inferred. No legal write-off authority is inferred.

Financial HR clearance now includes outstanding advances and paid/issued instruments, masks balances outside financial scope, and never silently ignores an unindexed legacy advance. No historical index backfill is performed. Cash repayment uses the pre-existing general-receipt path permitted by migration 023; its financial-party constraint is preserved.

The cash source suite runs against the full 014–025 additive schema, not just the HR base fixture. Thirty ledger/commitment/advance tests pass, including concurrent competing 70 AED disbursements from a 100 AED cash box (one succeeds), duplicate repayment reference prevention, full repayment, overpayment rejection and HR-clearance release only after debt is cleared.
