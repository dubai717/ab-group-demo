# Physical operating centres — checkpoint build, not deployed

Original sources were inspected: areas/emirates are geography, departments are administrative units, financial cost centres classify accounting, and `business-centers.js` groups existing screens. None is the actual operating-centre/company directory. Their identities are not reused as fabricated centre mappings.

## Source and guards

`backend/review/operating-centres.sql` remains an uninstalled review candidate outside automatic manifests. Dated append-only snapshots retain original tenant/user/emirate/area references and explicit company links, separate from legal domicile and financial cost centres. Recorded revisions and effective dates are independent: a current correction can coexist with an already scheduled future source. No old snapshots/links are rewritten or implicitly cancelled.

Runtime reads/inserts require an active Owner under forced tenant RLS. Update/delete privileges are absent. Revision continuity is serialized; links belong to the snapshot's original transaction. Actual actor and server timestamp are enforced. A simulated restored transaction-ID collision cannot append to an older snapshot because the original timestamp must match as well. This is not an actual restore test.

Read readiness verifies compiled policy dependencies, exact helper/trigger bodies, security modes, applicable roles, forced RLS, missing mutation privileges and enabled source triggers. A same-named public helper cannot qualify. The writer additionally pins actual columns/defaults/compiled constraints/validation/index state/dependency identities from an isolated compilation of this candidate. It never learns or approves a hosted schema. Schema drift needs code review, never automatic repair.

## Programmed API, unavailable without the candidate

Owner-only `GET /api/operating-centres` accepts strict `asOf`, uses the actual effective snapshot, SQL date text, bounded reads and encrypted source binding. Unconfigured and weakened sources are distinct. Reasons are excluded from its directory DTO. It changes no state. `writeReady` describes the separate guarded administration API; it does not grant geographic rights.

Owner-only plan/apply routes now reuse the original session/CSRF/request receipts, fresh original model, transaction and immutable audit. Names, actual geography and actual companies are validated. Existing inactive-company links can be retained, but newly linking an inactive/unknown company is rejected. A fresh plan binds original source versions, company facts and geography; it explicitly lists future snapshots that remain scheduled. Applying appends one source/link snapshot and encrypted before/after audit. It does not change users, grants, memberships, invoices, operations or journals. View As is denied. There is no automatic permission/scope application.

The Owner editor and original permission-screen integration are not implemented yet. The API/candidate remain on the checkpoint branch, not the current PR116 head, and have not been installed or called against hosted data.

## Evidence and limits

The final focused native group passed4/4: actual source API and encrypted/date/scope checks; actual plan/apply and original receipt/audit behavior; direct RLS/serialized revision/structural tamper checks; original work-scope summary regression. It covers empty/missing source, invalid inputs, active/inactive/future sources, same-key concurrent replay, changed-body conflict, stale revision, mandatory key, actual encrypted audit identity/reason, and a late XX000 audit failure rolling back all new source/link rows before an exact-key retry succeeds once. Original users/grants/memberships and actual financial table counts remain unchanged.

TypeScript, provider-free build,189 static checks and read-only financial95 review passed. These focused checks do not constitute full operational release acceptance. An early test incorrectly named a nonexistent invoice table; it was corrected to the original vehicle-invoice and financial-operation sources, without changing application schema or weakening assertions. Earlier source-guard metadata parsing issues failed closed and were corrected; no guard was bypassed.

Managed shell resets were recovered from pushed checkpoints. Current logs are hashed in ACCEPTANCE/BUILD-STATE; older ephemeral logs are observed earlier evidence, not falsely represented as retained artifacts.

## Remaining engineering

Original permission-screen centre editor, latest-recorded/future directory and immutable history display; retained inputs/trace/timeout/uncertain-save readback and AR/EN responsive browser acceptance; actual scope selection separated from primary work location; current authorized company/region/centre expansion without empty-scope broadening; fresh affected-user impact and actual API/DB enforcement using original roles/exceptions; compatible source rollback/restore acceptance. Future scope derivation must not silently turn a directory edit into permission grants. No new role or parallel permission engine.

No live source changes, financial activation, historical migration, merge, deployment or publication approval occurred. Do not install this candidate during build. No final approval is requested for this incomplete component.

The checkpoint additionally provides an explicit `view=latest` directory and Owner-only per-centre immutable history. Future-only centres remain discoverable; latest recorded revision is distinguished from the effective snapshot. History returns actual actor/time/reason without changing source rows or money. Fresh planning also returns original geography facts for a human review. The corresponding three-case native group passed, including a future-only centre and a current correction that preserves a separately scheduled source. Original work-scope/geographic enforcement remains disabled; this source directory is not an access grant.

The backend source component is included for PR116 review with its incomplete editor/scope status explicit. Final TypeScript, provider-free build and189 static checks passed after the latest source/history changes. CI30 fully passed the prior operational source, including unchanged original numeric-tax-filter acceptance; CI31 on the newer prior head remains in progress. Neither result is claimed as CI for the centre component. No running or pending CI was canceled, and no protected publication run was requested.

Before employee-location/schema integration, choose and test a formally referenceable stable centre identity (for example a generated root key on the immutable first snapshot) rather than pointing location FKs at an arbitrary revision. Do not infer location from company scope. Any future dynamic scope derivation must include actual affected-user review and database enforcement/rollback compatibility; the current administration API's no-authority-change claim relies on that derivation remaining disabled.
