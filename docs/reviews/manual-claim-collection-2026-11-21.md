# Non-sales claims in the original task/contact chain — build only

The original `ab.tasks`, immutable `ab.collection_attempts`, `recordChain`, My Work counters, contact UI and collection report are reused. There is no new task registry, contact history or customer invoice for a non-sales party.

## Accepted behavior

- A reviewed original claim with actual outstanding balance can be assigned only by the existing task creation/assignment rights. The chosen active employee must already have company-scoped ledger view/collect rights and cannot be the employee who owes the claim. No grants are created by assignment.
- A scoped collector executes the original four-result chain without requiring a manager/task-creation grant: off → 60 minutes; busy/no answer → 30 minutes; answered → documented follow-up date/type. Each executed task is completed once and gets at most one original successor.
- Four contacts followed by a payment appointment two days later yield four completed tasks and one future task. The future appointment does not count as today's open collection work. Neither a contact nor promise changes the claim or creates an RV/invoice/journal.
- Company/task scope, repeated Save, immutable history and payment-receipt provenance are enforced on the server. Names/party references are displayed as non-sales parties, never as invented customers. Actual approved cash receipts remain in the original RV/custody flow.
- The existing report separates customer, employee and external balances. Collection amounts are derived from original posted receivable/receipt journals and reversals; contact counts remain productivity metrics. Customer invoice calls still pass their original source checks after applying the proposal in isolation.
- Actual UI acceptance includes Owner assignment from the existing financial register, the collector's original task-center rows, all four outcomes, future appointment, bilingual responsive history, fixed outcome colors and party-separated report. Native RV details show the party and claim number without creating a customer link.

## Review-only schema boundary

`docs/proposals/manual-claim-collection.review-only.sql` checks the exact original collection-source guard before changes. It extends the **original** attempts table with one optional manual-claim source, preserves the original invoice/customer identity requirements for invoice attempts, and validates the new source against the original task, company, actor and posted claim journal. All old foreign keys, immutable history, RLS and grants are retained. An unknown old guard aborts before DDL. The file is outside every approved migration directory/catalog; it has only been applied in synthetic local fixtures. An absent/unreviewed version marker blocks assignment/attempts with no task creation. No hosted financial schema activation is claimed.

## Evidence / remaining

- `manual-claim-collection.test.ts`, `collection-chain.test.ts`, `manual-receivable-claims.test.ts`, `my-work.test.ts` and `contract-financier.test.ts`: nine targeted cases passed, including mixed original invoice/non-sales source reports, guard rejection, grant preservation and safe retry.
- `manual-claim-chain.browser.cjs`: real task-center/collector/report acceptance passed. `manual-claims.browser.cjs`: real native RV attribution and retained overcollection inputs passed.
- 172 static tests, TypeScript and portable build passed.
- Previous committed claims checkpoint `7214e53` / matching remote tree `1d644f2bc3fbb396964c612af45a9b6725bfe9b5`: **494 cumulative backend tests passed**. The new contact adapter is additional work and will receive its cumulative regression separately.

Requirements 4.5/4.7 remain partial until employee-advance queue integration, noncash recovery/correction acceptance and wider reports/exports are completed. No deployment, protected-run modification, historical migration or original Supabase write was performed.
