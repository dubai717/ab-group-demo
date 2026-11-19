# Unified service cycle — Staging review

Base: PR #106, `60d9f9d9e98a5010f0e53167cdda83afea2a26aa` (verified live on Render before this change).

## Causes and implementation

- Residence/general approval was optional (`requiresApproval`) and a newly saved service normally stayed Open. New submitted services now require the Owner; explicitly submitting a retained old optional request appends the same mandatory policy without rewriting its creation event. Both paths append Submitted/Pending source events and notify active owners. The existing approval-center adapter supplies the same decision to My Work; it does not insert a second approval task.
- Incomplete drafts use immutable, encrypted **existing customer events**, scoped to the creator. Draft-to-native-request conversion and its receipt commit in one database transaction under a draft lock. Concurrent same-key requests serialize before the existing idempotency cache; retries also recover the original conversion by draft ID. Saving a draft creates no invoice, vehicle or payment.
- Returned service corrections append before/after events to the same request, with revision checks and the recorded reason. Resubmission completes the existing correction task. Approval moves to execution; rejection retains a Cancelled historical record. Creator execution work and unassigned registration coordination are read-only projections of source records.
- Old installment policy settled the remainder in the last installment. New proposals carry `first_balance`: first = (approved total obligation minus separate down payment) minus (term minus one) times regular installment. Integer money arithmetic balances the native schedule. Negative/zero first payments and mismatches are rejected. Existing unversioned schedules are not recalculated.
- New requests default the separate monthly plate fee to AED 300; explicit contractual amounts remain configurable. No currency conversion is performed.
- Vehicle catalogue type/make/model are aligned in a reusable responsive row. Existing catalogues, searchable controls and authorized catalogue additions are retained.
- Disbursement choices use real active employee profiles, employment company scope and existing explicit receive/view/registration permissions. Historical workflows retain their original receiver policy. No access is granted by this UI.
- Cash links a posted principal/cash journal, scoped fund and clean evidence; transfer/cheque link a native approved payment with clean evidence. Prepared/unsigned/uncleared cheques do not qualify. New investor cash also retains accepted funding/agreement and actual available capital checks. Recording the link creates no second financial posting.
- The Owner and selected recipient can review the actual handover date and native payment/journal reference; unrelated viewers receive neither the extra reference nor the encrypted handover payload. Exact employee receipt remains distinct from Owner approval and disbursement. Only then is the canonical registration task assigned to the recipient. Existing documented reassignment remains available.
- Bank-direct execution requires Owner confirmation of actual settlement, its reference and clean bank evidence. It skips fictional employee cash disbursement/receipt. The original separate bank and customer schedules and native bank-transaction links remain in use. Recording agreement/evidence does not silently post a loan, payment or bank repayment.
- Positive service fees require Owner approval and recorded execution before native invoicing; zero-fee general services produce no invoice. The authorized operator selects the approved financial item in the existing invoice action rather than guessing a revenue/account mapping. Positive services cannot be finally closed before their linked invoice exists. Invoice creation never counts as collection.
- Completed action forms refresh source records and work counts. A stale read-only request register no longer overlays the vehicle decision page; dirty form navigation still requires confirmation. Request-register refresh is awaited once, preventing a second refresh from resetting a newly chosen filter.

## Validation

Local isolated database/API tests cover incomplete drafts, owner approval for residence/free/paid general services, same-record return/correction/resubmission, concurrent/replayed submission, exact first-installment arithmetic, unchanged legacy schedules, separate bank/customer schedules, bank-direct registration without a payment, employee display names, posted cash reuse, receipt amount mismatch and registration assignment. Existing vehicle/service/account/authorization and employee-login tests are retained.

Browser journeys cover the three service types, draft save/resume/submit, zero/positive service fees, native invoice/collection linkage, Owner decisions, correction, independent company choice, catalogue controls, installment recomputation, dirty navigation, reassignment, existing collection-task regressions and Arabic/English desktop/tablet/phone layouts. Static suite: 172 passing tests; TypeScript and JavaScript syntax checks pass. The protected CI run remains the authoritative full regression result.

## Data and release boundaries

No schema migration, live data repair, historical balance/contract rewrite, permission change, Work Amount/marketing change, production release, secret change or deployment configuration change is included. Test cash/journals are confined to newly created local synthetic databases; no real cash movement is tested.

Missing reference pictures block no specified functional requirement. Hosted authenticated end-to-end verification must run against the released Staging commit; local/provider-fixture tests are not represented as a live Staging transaction. Delivery must pass the existing source CI and protected `staging-owner-approval` gate. Merging alone does not establish a successful Render deployment.
