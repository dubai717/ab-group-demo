# Selected denial removal during standard updates

Build/review only; no hosted installation, real data change, merge or deployment.

The existing Owner standard plan/apply now accepts an explicitly selected list of current individual denial actions, separately from selected original direct grants. The initial/default policy remains retain all. Only current members of the chosen custom standard may be selected. Unknown, duplicate, outside-standard and Owner/self targets fail closed. A nonempty reason is required and bound to the fresh review hash. Unselected denials, direct grants, company scopes and dashboard overrides remain unchanged.

The same original role transaction writes the reviewed standard, selected original grant removals, selected encrypted denial history/current records, employee revisions and an optional staged dashboard restriction. The existing permission editor and standard editor share only the denial persistence helper, not a parallel authorization system. The helper itself does not alter grants or roles. Removing a denial can restore only underlying original authority, not manufacture a grant.

The original standard modal lists additions and denials separately, with scope and explicit checkboxes. Moving or choosing a section does not select anything. Selecting denial removal requires its reason and a new impact preview. API-preview failure retains both the selection and reason. Approval is disabled after any edit until preview succeeds. No denial controls are enabled before the separately reviewed denial RLS guard exists. Grant removals still need their existing independently reviewed procedure.

Verification so far:10 focused native tests passed, including injected history-write failure rolling back the entire mixed role/grant/denial transaction, same-key retry once, stale/changed reason, cross-standard and duplicate selections. Four overlapping focused browser journeys passed in Arabic/English at desktop/tablet/phone widths.189 pure regression checks, TypeScript and provider-free runtime build passed. The full native suite then passed757 tests, including a denial-only guard case without the grant-removal procedure. All22 UI journeys passed before the subsequent shared-cache change; the final23-journey suite including that change also passed. No final-head GitHub CI conclusion is claimed.

One browser failure during development exposed an accidentally removed neighboring standard-dashboard review helper. Its original implementation was restored before the successful focused journeys. This failed attempt is not acceptance evidence.

Remaining: full employee reset (including company/bank/widget overrides), dashboard inheritance and chart/table previews, geographic scope, other operational acceptance and the unmerged financial dependency. This closes only selected denial removal, not all of requirement3.2/3.3 or the financial95.
