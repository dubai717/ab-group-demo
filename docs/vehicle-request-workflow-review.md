# Original vehicle workflow review

Scope: `dubai717/ab-group-demo`, Staging only, PR #101, additive to #100. No database migration, historical update, grant change, financial flag activation or cloud test seed.

## Existing mechanisms retained

Original `vehicle_requests`, `vehicle_events`, approvals, custody, approved cash journal/payment evidence, registration activation, vehicle contracts, invoices/recurrence and versioned investor capital remain authoritative. Residence/general requests already use immutable customer events and the existing financial ledger. The single customer composer already existed and is retained.

Previously, “Complete review data” filled proposal fields missing from historical requests and was available while funding was Requested, even before a return. It could also show actual lender terms during initial proposal review. New proposals are server-assigned workflow version 2. They are read-only after submission; only a return opens the specified fields. Correction events and explicit resubmission keep the same request ID and increment its revision. The correction editor is available only after a return, including for pending historical requests; historical approved terms and accounting rules stay unchanged. No public version downgrade is accepted for new creation.

Cash means customer-funded purchase. The server requires approval before registration, rejects company-financing disbursement, and enforces zero financing amount/monthly/down payment. Activation uses the original service contract with zero financing and independent registration fees. No loan schedule is created.

Group/investor/bank financing continues through native approval, proven actual payment, receiver acknowledgement, registration, scanned ownership/insurance and contract activation. New derived installment totals use exact integer minor units. Independent historical fees are informational in the existing review payload; this change neither adds them to principal nor invents a billing rule.

Bank and customer agreements were already distinct. New requests approve the proposed customer terms first, then an authorized approver/disburser records the real bank agreement and scanned evidence before any purchase disbursement. Actual bank terms cannot be overwritten through that arrangement action after approval. Native explicit links to approved Finance transactions remain the only bank repayment evidence. Customer collection never creates a bank repayment.

The customer register now joins the original request with its actual registered vehicle, so a pending request is visible without becoming an active vehicle. The customer/vehicle count queries are unchanged. List projections aggregate request decisions in SQL instead of adding one network round trip per record.

Notification client numbers are joined from actual customer/request/vehicle relationships and only returned when the recipient also has customer-view rights. Existing notification ACL and explicit read receipt actions remain in force. Human labels are presentation only; original event codes are retained.

## Preservation and operational limits

Only synthetic local databases and provider stubs are used for financial lifecycle tests. No legacy account, balance, document, contract, invoice, Auth user or permission is altered. No automatic late-fee worker or new priority allocation rule is activated. Live `req-8p` diagnosis and employee-account correction are documented separately in `user-enrollment-req8p-review.md`.

A merged PR is not a deployed release. The protected Staging controller and owner approval remain mandatory. Actual hosted create-user success requires a genuine authorized session and must not be claimed from synthetic tests.

## Verified isolated checks before PR checks

- 16 targeted database/API tests passed, including independent 36/48 bank/customer schedules, original investor allocation and frozen version, cash without company funding, same-request corrections/resubmission, same-millisecond revision ordering, final installment precision, scoped notification links and no implicit read receipts.
- 170 static/controller tests, TypeScript and portable JavaScript build passed.
- Actual browser runs passed group approval → posted disbursement → receipt → registration → scanned originals → activation → invoices/reopen; unified approve/reject/return, required correction fields and explicit same-ID resubmission; cash composer with no financing/disbursement; original residence/general save/readback; customer save/draft/document flows; reviewed investor version preview; existing financial-package UI; employee login save/retry/readback; organization, permissions, dashboard, task and contract regressions. AR/EN desktop/tablet/phone checks passed.
- The initial full backend run had one new synthetic fixture setup failure (the restore drill expected a legacy investor). Seeding the isolated legacy fixture corrected it; the final 16-test targeted rerun passed. Full native GitHub checks remain mandatory on the final commit before merge.

The 0.001 ledger precision difference in 10,000 / 3 at 3,333.333 is explicitly assigned to the final installment (3,333.334); larger principal shortfalls are refused. This does not recalculate historical contracts.

The final local backend run passed all 398 tests, with 170 static/controller tests and the compiled build also passing. A native CI attempt then exposed a timing race in the pre-existing financial-register browser test: it reselected the already selected company and started checking vouchers before that asynchronous reload completed. The test now waits for the actual company render and page identity, asserts both distinct selected voucher IDs, and exercises delayed preference responses. Three independent fixture runs passed. No financial runtime or selection algorithm was changed to address that CI failure; the final native checks must pass before merge.
