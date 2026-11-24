# Original vehicle execution — isolated integration only

The original disbursement/fund-assignment and registration handlers now expose one trusted server execution callback after original authorization/source checks and before new fund/vehicle/asset records. It is unset in `server.ts`. The isolated adapter refuses every non-`ab_backup_<32 hex>` operating database name. It cannot issue an Owner financial approval or enable a real policy.

Actual user/tenant/actor, original vehicle action, original request/customer/company identity and the original HR work guard are checked before any old-execution continuation. View As and technical/system actors are refused. A registration operator does not receive customer-profile or ledger-view rights merely to obtain a minimal eligibility result. The request row retains its original lock. New execution uses the same bounded actual-actor financial snapshot and approved two-actual-due-month rule.

Only registration can use verified prior execution: matched original approval/fund-receipt chronology, or the separately verified actual Cash registration-task start. Assignment/display dates alone do not qualify. An unproven old request requiring grandfathering becomes Needs review rather than a fabricated exception or a hard claim that it is new work. Every accepted old continuation appends a scoped encrypted event in the original vehicle history, with actual current performer, policy/source reference and reason. The request lock plus bounded exact existing-evidence check avoids dependence on NULL vehicle_id uniqueness. Action failure rolls the event back with the original transaction. Technical audit details are not exposed as ordinary UI labels.

## Verified original API behavior

`service-eligibility-execution-hook.test.ts` proves:

- New disbursement and registration at the threshold create no fund/vehicle/task/event/financial/dedup records.
- A scoped actual employee with vehicle-create permission gets the correct arrears decision while full customer profile and ledger APIs remain forbidden. No profile or finance grant is manufactured.
- Recording an actual previously delivered employee-fund receipt remains available; it does not pay the customer's invoices.
- A verified old funded request continues while customer arrears stay open. Its original actor/source audit is retained once; repeated registration adds no duplicate vehicle, audit or money.
- Cash approval/assignment with no actual old start cannot bypass the rule. A verified old Cash task start permits original registration, still Pending review, with no purchase fund, invoice, receipt or journal.
- Missing old evidence returns review. Recovered-source verification against locked dependencies passes the execution/actual-actor cases, TypeScript and provider-free build. Earlier linked creation/approval/execution/source cases passed separately.

## Incomplete / not active

This uses an explicit **synthetic effective day** (midnight Dubai), not a recorded live activation timestamp. Precise prospective activation evidence, bank-direct execution and remaining nonvehicle lifecycle adapters, lifecycle restart/cancellation/delegation/return coverage, timed Owner exceptions, complete action/child/FK/dependency compilation and integrated final acceptance remain unfinished. Upstream actual financial-payment authorization is not claimed guarded merely because the original request's fund-assignment API is checked. Original financial approval/reconciliation protections remain in force. No historical balance, original immutable row/trigger, real data, grant, database connection, protected gate or deployment changed.

## Residence/general first-start integration

The original `/customers/:id/requests/:requestId/status` handler now offers a separate trusted callback only for the **first** InProgress transition, after its original authorization, revision/transition checks and original advisory lock. Server configuration does not set it. A client cannot submit a prior-start flag. Existing immutable original InProgress history keeps a subsequent pause/resume outside the new-service first-start check; this preserves existing work rather than issuing a new approval or reconstructing historical execution.

The isolated adapter checks the random test database name, actual human/session context, original request/customer/company/type, and a bounded original event history (2000 actions, 1MiB aggregate, 64KiB per record). It refuses a legacy optional-review first start without an actual recorded final Owner approval; the original resubmission path can establish mandatory review. It then uses the same actual-actor, original work/source checks and approved arrears calculation. No grant is manufactured. Owner approval already starts ordinary new requests atomically and remains covered by its separate existing approval hook.

`service-eligibility-nonvehicle-start.test.ts` passes against a disposable native PostgreSQL fixture: both residence/general first starts refuse at the threshold with unchanged event/request/task/financial/dedup hashes; legacy first execution cannot skip Owner review; an already-started legacy service can resume; original incoming receipts settle the debt; both approved first starts then succeed without creating invoices/receipts/journals. Synthetic histories are new append-only records, not updates to immutable originals. This is one linked native acceptance case, separate from the earlier frozen908/49 baseline; it does not complete live activation, precise prospective boundaries, exceptions, all lifecycle adapters or final acceptance.
