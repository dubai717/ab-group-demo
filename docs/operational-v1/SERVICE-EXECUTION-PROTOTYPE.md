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

This uses an explicit **synthetic effective day** (midnight Dubai), not a recorded live activation timestamp. Precise prospective activation evidence, bank-direct and nonvehicle execution adapters, lifecycle restart/cancellation/delegation/return coverage, timed Owner exceptions, complete action/child/FK/dependency compilation and integrated final acceptance remain unfinished. Upstream actual financial-payment authorization is not claimed guarded merely because the original request's fund-assignment API is checked. Original financial approval/reconciliation protections remain in force. No historical balance, original immutable row/trigger, real data, grant, database connection, protected gate or deployment changed.
