# Unified tasks, vehicle decisions and collection follow-up

Scope: `dubai717/ab-group-demo`, staging only, based on PR #101 / `633def8`.

## Decision diagnosis and source of truth

The previous browser disabled the decision submit button when the proposal review had missing mandatory values. It supplied no inline result when users tried to confirm. That reproducible path is replaced by explicit validation listing the missing fields. Valid approvals, including optional notes, execute the original locked/revision-checked API; the browser reads back the saved request before reporting success. Failures carry a sanitized request reference. Refreshing optional disbursement reference data no longer masks a committed approval as a failed decision.

The particular reported hosted attempt has no request number/reference yet; do not claim its cause is proven by this reproduction. Render was verified live on PR #101, and its available application-error log contained no corresponding failed decision. No live financial or authorization records were modified for diagnosis.

The original owner approval / returned-field / same-request resubmission / Cash / bank arrangement guards remain authoritative. No second approval workflow was introduced. Only an explicitly selected, authorized employee receives the next-stage task. A missing assignment is shown explicitly, never assigned to the owner merely because of role. Existing registration tasks are deduplicated against their source, including historical task keys. Actual source actions complete the relevant stage tasks.

## One work center

The existing `/api/my-work` adapter joins native tasks and actionable approval projections. The Tasks page and dashboard consume that source. The page defaults to own tasks; other/all views require existing management rights or an actual direct-report relationship and retain company/database scope. Date, company, department (including recorded additional units), employee, type, status and priority filters apply to the source. Future timed tasks are separate from due work. Completed tasks remain in history. Completed decision projections refer to native event identities; notifications never count as personal work.

Employee performance reports distinguish actual completions, day-start work, new work, due remaining and future work. A bounded source fails explicitly rather than presenting truncated counts.

## Collection chains

New forms use `chainVersion: 2` on the original collection-attempt endpoint. The existing transaction locks the current task, inserts its immutable attempt, completes it, creates a native successor with a unique source key based on its predecessor, records task audit events and queues the existing delayed notification. Replayed idempotency keys return the original result; another key cannot complete the task again. Earlier attempts and legacy API behavior remain readable/compatible.

- Switched off: successor after 60 minutes.
- Busy / no answer: successor after 30 minutes.
- Answered: notes required; optional payment/call/visit appointment requires its future timestamp.

All successors retain the original invoice/customer and predecessor/root links. A promise never posts a receipt, invoice, allocation or journal. Actual payment references must resolve to an approved receipt allocated to the same scoped invoice. A missed payment appointment is an explicit recorded fact permitted only after its scheduled time; phone outcomes alone never infer a missed appointment.

Timestamps are stored in UTC and displayed in Dubai time. Explicit configured working days/holidays are respected. There is no configured office-opening/closing-hour policy in the existing schema; none is invented. Historical schedules are not rewritten.

Four semantic colors accompany readable labels. Contact counts and employee call performance exclude verified-payment actions. Money is reported separately from authoritative current balances of distinct followed-up invoices, grouped by currency; it is not represented as money collected on the dates of calls.

## Preservation / release

Reuses `tasks`, `collection_attempts`, native vehicle events, financial allocations and notifications. No DDL, new financial migration, permission rewrite, historical balance recalculation, deployment-policy edit or secret change. Rollback is the prior application commit through the protected staging delivery path; new native history is retained and remains readable. Deployment requires successful native CI and the protected owner gate. A merge alone is not a deployed release.

## Validation evidence

- TypeScript checks and runtime build passed.
- 170 static/controller tests passed.
- Full isolated backend run: 399/400 initially passed. The new report test detected a SQL token-spacing error; it was corrected and the affected collection/task/vehicle workflow suites were rerun successfully (including independent bank/investor workflows). The required native GitHub CI reruns the entire suite before merge.
- Real Playwright browser: optional-note approval, rejection/return/resubmission, readback, missing-data validation, repeated-click protection, explicit next-stage assignment, Cash registration, own-task defaults, row navigation, all four contact outcomes, automatic successor times, two-day payment promise, unchanged financial balance and the four report colors passed. Arabic/English, desktop/tablet/phone were exercised.
- Supabase/Render used records were not changed. No genuine authorized hosted application session was available for a positive account/financial action test; none is claimed. The supplied real request numbers are not used to approve or alter live requests.
