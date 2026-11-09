# Permanent staging delivery

Scope: `dubai717/ab-group-demo`, `staging/ab-group-test`, existing Render test service and original test Supabase project only. Production is never a target.

Successful current-source CI -> protected main controller -> semantic change classification and read-only schema readiness -> optional native owner gate -> serialized schema verification -> exact-source Render deploy -> real HTTP/browser smoke -> recorded deployment status.

Ordinary changes do not reference a reviewer environment and require no SHA variable. UI, filter, validation and nonprivileged workflow improvements are classified by their changed security boundaries rather than an entire mixed source filename. Unknown syntax/changed dynamic operations fail closed. Credential material is blocked. Permission distribution, privileged identity changes, destructive operations, reset, secrets, connections, deployment policy and SQL remain sensitive. Pending migrations always require owner approval plus the existing encrypted backup/isolated restoration gates; ordinary releases with no pending migration never apply SQL.

`staging-owner-approval` is retained, including its existing reviewer and no-bypass settings. `supabase-test` contains deployment secrets; it must have no required reviewer for ordinary releases. No environment/ruleset/secret settings are changed by the implementation.

The immutable controller activation may pin one exact source tree explicitly covered by the owner's policy-change authorization. This is not a reusable source exemption; subsequent changes are compared with the last verified live deployment and classified normally. Controller code and its pinned SHA are reviewed in PRs.

Older deliveries are cancelled only if they are from the same main dispatch and no schema/release work has started. Unknown job names or started schema/release work prevent cancellation. Schema and Render submissions are independently serialized with cancellation disabled. Current branch checks refuse stale releases. Cancellation does not approve sensitive changes or stop a migration already started.

Every delivery records tested source SHA, immutable controller SHA, classification, previous release SHA, CI result, Render result and public browser smoke. A CI pass alone is never deployment success. Rollback uses the recorded previous source commit and the same protected exact-source delivery; no automatic database rollback, reset or data removal. Schema failures stop publishing and require recovery review.

Tests cover ordinary changes, permission guards, identity, SQL deletion, storage/secret exposure, unknown code, environment separation, migration gating, stale waiting runs and active migration protection. Final acceptance requires an actual ordinary staging deployment with owner-approval skipped, live SHA match, pinned project match and browser smoke passed.
