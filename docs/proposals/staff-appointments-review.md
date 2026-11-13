# Review-only: multiple role bundles and temporary appointments

Repository: dubai717/ab-group-demo. Extends the existing PR #61 proposal; no numbered migration, hosted activation, current-user assignment or financial 028 deployment.

## Authoritative records

The employee's primary role, existing company/unit memberships and personal grants remain intact. Additional roles reference an explicit saved role-template version. Each application specifies one company and an optional organizational unit context; the actual grant scope is displayed separately as COMPANY, never silently narrowed to a unit. Multiple role applications may coexist and share a grant. Additional-role bundles cannot introduce final approval/decision/grant/payment authority; existing primary/personal rights are not rewritten. Existing `ab.permission_grants` remains the only operative fine-permission engine; no second permission list authorizes API actions.

The appointment proposal depends on `owner-role-bounds.review-only.sql`. Four new empty tables store appointments, grant-source links, task-source links and immutable appointment events. New functions/guards add a restrictive time/source eligibility policy to the existing grant table. Installation leaves all prior rows, balances, role definitions, grants, memberships, function definitions and original ACLs unchanged. With no appointment links every existing grant remains eligible.

## Time and safety

- Owner-only plan, explicit confirmation hash and apply; no self/owner target and no automatic grant to existing users.
- Date eligibility is checked by the DATABASE clock on every grant read. Scheduled grants are absent before their start and after their end, even if no scheduler runs. Early termination changes only the appointment's end marker and audit, never deletes history. A reused personal grant survives ending a role or appointment.
- Delegation explicitly selects original employee, substitute, company, task IDs and/or existing source-grant IDs. The source must actually hold each company grant. Transitive delegation is rejected. Approval/decision/grant/reset/funding/disbursement/settlement/write-off/payroll authority is not transferable; primary/base-role authority is not copied wholesale.
- Revoking an original source grant invalidates its temporary derivative. Ending the original employee's employment invalidates delegation. Target inactivity or removed company/unit membership immediately disables the appointment. Overlapping delegations for the same task are rejected by a locked DB guard.
- Canonical task IDs and physical assignments stay unchanged. Existing task access/list/action procedures resolve the active substitute at read time; a start/submit does not overwrite the canonical employee. At expiry open tasks immediately resolve back to their original assigned employee without a worker or duplicate task. An explicit subsequent reassignment overrides the old task link.
- Existing task action, source completion, business-module read rights and final approvals still apply. Tasks-only delegation grants no customer, financial or approval access.
- Audit records owner authority, confirmation, selected sources and schedule; the existing optional personnel worker records observed activation/expiry once when enabled. Eligibility does NOT depend on this worker. No background-worker secret/environment setting was changed.

## UI

Existing dual permission lists remain. Every operative fine grant shows its sources (personal plus role/unit/temporary where shared), inherited grants stay protected, and approved exception handling remains in the existing engine. Additional-role/appointment UI uses the current user profile, floating records and bilingual responsive controls. Templates are curated fine-permission bundles, not an automatic copy of every legacy primary-role privilege.

## Explicit limitations requiring further design

There is no operational branch model/branch association on the current customer/vehicle/financial registers. The API REJECTS a non-null branch scope, and the UI states that branch scope is unavailable. Unit context does not fabricate row-level unit attribution where business records lack it. Therefore complete branch-specific and per-business-row unit authorization is NOT implemented or claimed. It requires a separately reviewed additive branch/record-association design and explicit assignment of existing records; existing data will not be guessed into branches. Existing approval/rejection rights that are coupled in original workflows remain coupled.

MDB/ACCDB import and ordinary contract/task UI are separate safe work. The financial 028 agency migration is not activated by this proposal.

## Verification and delivery

Isolated tests cover two additional role versions, preserved primary/personal rights, source-bound temporary permission and original task access, expiry with NO worker, SQL-level hidden expired grants, early termination, owner-final-authority/branch rejection and non-owner denial. The real browser journey covers additional-role save, combined task/permission appointment and early end in Arabic/English at desktop/tablet/phone sizes. The expanded preservation test performs real encrypted isolated restore before/after both permission proposals and compares every populated old row, original function and ACL, including legacy 50/100 investment versions and private document bytes.

Activation requires explicit owner consent to both exact reviewed SQL files, catalog/order review without renumbering or implicitly applying financial 028, a fresh encrypted hosted backup with isolated verified restore, atomic rehearsal and unchanged-row/grant checks, then the native protected staging gate. Until then this stays draft and is NOT merged/published. No Production, Reset, deletes, existing balances or automatic current-user permission changes.

Before appointments exist, reverting the application is a code-only recovery. After appointments exist, use a compatible forward fix or explicitly end affected appointments while retaining their history; old code cannot display temporary task resolution correctly. Never drop the eligibility policy/guards while temporary grant rows exist, and never restore an old database over later financial activity automatically.
