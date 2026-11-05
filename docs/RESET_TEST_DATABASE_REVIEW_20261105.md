# Reset Test Database — review and isolated rehearsal, 2026-11-05

## Status: NOT ready for a live full reset

No hosted application/user/business/file deletion, live schema replacement, role/RLS change, main/staging merge, Render deployment/settings change or secret change was performed. The only new hosted objects are the explicitly authorized encrypted backup and its encrypted metadata. Old backups and both Supabase projects remain intact.

The Owner settings UI and server-side approval controller are implemented in the review branch. The privileged worker is an interface, **not a connected live implementation**. The rebuild executable deliberately refuses all hosted connections and only accepts the named loopback rehearsal database. There is no live Reset button on the currently deployed site, and enabling a UI flag alone cannot reset it.

Do NOT request or interpret a final live-reset approval until the uncompleted external-provider/execution gates below pass. A PostgreSQL-only reset does not physically remove managed Auth accounts or private storage bytes.

## Preserved original system and cancelled new-project path

Actual unauthenticated GET `/api/release` verified current Render `https://ab-group-demo.onrender.com` remains staging release `4a162b926352208b85cf53a8d9d4f0c3ecc20841`, with the original project's approved public-origin SHA256 `9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f`. Server startup requires the runtime pooler username to match that configured project, so this also corroborates the original runtime target. The original environment `supabase-test` is used for read-only source checks and private backup retention.

No work to connect Render to `ab-group-erp-clean-test` continues. Its correct ref is `rdsqerenobigacmetryv`. The new project's failed connection checks are stopped; no currently running clean-project jobs were found. Its verification workflow on the historical verification branch uses `supabase-clean-test`, but does not deploy. Do not delete that environment/project until separately approved. Existing code/history/branches are retained.

## Implemented approval controls

- Owner settings panel, Arabic/English, desktop/phone presentation; hidden when not an explicitly activated original staging environment.
- Server session/role check, trusted-preview Owner-ID binding, existing same-origin/CSRF checks, rate-limited fresh password verification through the current Auth provider.
- Temporary verification logout uses `scope=local`, preserving the Owner's original session; normal logout behavior remains unchanged.
- Preview must be at most ten minutes old, unexpired, and have verified backup/restore with no blockers.
- Explicit `RESET TEST DATABASE` phrase; encrypted five-minute confirmation bound to actor, tenant, session and plan fingerprint.
- Atomic one-use request insertion and rejection of parallel pending requests; audit event, no password persistence and no request-dedup response cache for secrets.
- Dialog cancellation/visibility clears credentials and prevents submission after a delayed reauthentication response. Double submission is disabled.
- A submitted intent is labelled `ApprovedAwaitingWorker`, **never reported as a completed reset**.

## Actual isolated tests

1. Full backend/demo regression bundle: 188 backend + 128 existing frontend/domain tests, all passed (316 cases): run https://github.com/dubai717/ab-group-demo/actions/runs/42050577619 . Its first fresh-backup job failed because the restore container lacked its TLS CA; only the backup job was retried after correcting certificate setup.
2. Final focused anti-replay/concurrency/freshness/cancel tests: two controller cases and four AR/EN desktop/phone browser cases passed: https://github.com/dubai717/ab-group-demo/actions/runs/42053653643 . Additional local provider contracts passed for legacy/modern Supabase keys and local-only verification-session logout. Initial local socket tests were sandbox-blocked; rerun with loopback access passed, not a Supabase failure.
3. Fresh encrypted backup, actual isolated PostgreSQL 17 restore and verification of all database rows/tables/constraints/RLS/triggers and 96 encrypted documents passed: https://github.com/dubai717/ab-group-demo/actions/runs/42051835753 . Private download hash verification and anonymous access denial passed.
4. Rebuild from that fresh archive passed: https://github.com/dubai717/ab-group-demo/actions/runs/42056453072 . All approved 001–013 migrations replayed; 107 business/history tables empty; original Owner application profile and Auth row unchanged; approved role catalog identical; root geographic/purpose references retained; outside-application tables/constraints/policies/triggers unchanged. The restored app snapshot matched current original source application contents at inspection time. A second untouched restored clone remained an exact rollback reference.
5. Real Backend Owner login/bootstrap passed against the rebuilt clone with an explicitly labelled Auth test double. **This is not a successful real Supabase password login after a hosted reset.** Auth and Storage managed-service cleanup have not been executed or proven by this rehearsal; their source rows deliberately remain unchanged.
6. Fixture-free post-deploy smoke unit contract and actual public GET-only Render/desktop/phone checks passed: https://github.com/dubai717/ab-group-demo/actions/runs/42058350749 . An initial check incorrectly probed nonexistent collection routes; it was corrected to existing protected detail routes. No live users, business fixtures, login sessions or object writes were created by the successful probe.

## Fresh retained encrypted recovery archive

Original project's private bucket `ab-private-test`:

`ab-group-backups/v1/20261105T150819784Z-793d19a6-332c-4d54-9716-b8ab4911faa4/database.abbackup`

Companion: same directory `metadata.abmeta`. Both encrypted, create-only; download/decryption/restore and public-denial checks passed. Keep original DATA and BACKUP encryption keys safely; neither was changed or disclosed. A new current backup and consistency check under a write freeze is still required immediately before any future live reset; do not treat this dated archive as a perpetual deletion authorization.

## Provisional whole-database preview — NOT a final deletion list

This full reset would affect more than the previous TEST_DATA manifest (5 companies / 7 bank accounts). Current whole-database inspection found:

| Category | Current rows / proposed removal scope |
|---|---:|
| Companies / licenses | 12 / 12 |
| Bank accounts | 15 |
| Customers | 30 |
| Vehicles / assets / requests | 50 / 50 / 50 |
| Financings (`vehicle_funds`) | 12 |
| Invoices | 342 |
| Receipts | 28 |
| Tasks / notifications | 35 / 386 |
| Posted balanced journals / entries | 358 / 716 |
| Employees | 5 |
| App users | 18 total: retain original Owner, remove 17 |
| Other identities | 10 managed test + 7 legacy synthetic; no unclassified app usernames/emails |
| Private business objects | 96, excluding all retained-backup objects |
| Organizations | 8 total: retain original Owner's organization |

Counts and manifest hashes are provisional point-in-time observations. No individual row/file has been approved for live deletion by this report. A final signed preview must include identifiers/provenance/dependencies, every additional child/history/financial/counter/session/audit row, and changes since preview. Do not merely delete 5/7 old manifest rows or silently retain old immutable financial history.

The rehearsal retained the original Owner's complete application profile/auth_id and unchanged Auth row; seven emirates; 367 canonical areas and 760 aliases; five purpose reference entries; exact role/permission catalog. It excluded the synthetic bootstrap `demo-bank` reference. The fourteen chart definitions were previously identified as TEST_DATA-generated; the prototype clears them and all company/bank chart links, not an independently approved production chart. Any neutral additional configuration/chart templates to retain must be expressly whitelisted before a live plan; company-specific test configuration and sealed old test registries must not be copied back. The demo bank and fixture chart are not silently presented as essential operational configuration.

## Permanent retention fix included for review

The existing `staging-live-smoke.ts` creates a new cloud Auth identity, organization, company and bank on every deployment. This explains the legacy synthetic accumulation. The review changes `.github/workflows/staging-ci.yml` to invoke a credential-free **GET-only** post-deployment smoke instead; authenticated creation/persistence tests remain in isolated CI. Existing seeding tools/history are not deleted and are not part of ordinary delivery. This change is not deployed yet: do not assume the currently installed old pipeline has already stopped seeding.

Regular releases must preserve all manually entered trial data. No reset on push/start/build, no automatic restoration/replacement, no default fixture provisioning, no destructive/down migrations. Only an independently reviewed safe migration chain and passing tests/backup gates may update staging. Financial/permission/destructive changes still require the owner's approval. Keep code SHAs, migration checksums, test evidence and a compatible code rollback target.

## Required live execution design and uncompleted gates

Use a privileged asynchronous job in existing GitHub Actions, **not browser admin credentials or an administrative connection in the web process**. A one-time protected dispatch mechanism from Render to that reviewed job is not currently configured/implemented. No dispatch secret or new permission was created here.

Before enabling it, finish and test:

1. Trusted signed/expiring preview and approval delivery to the job, persistent nonce consumption and run state outside the replaceable `ab` schema; only original staging target and primary Owner. Never arm it on production.
2. Durable maintenance/write fencing (including restart/worker-failure handling), fresh encrypted capture/actual restore proof, current-state fingerprint comparison and outside-schema dependency checks before destructive DDL.
3. The exact in-place destructive operation is **replace application schema `ab`, replay latest approved migrations and reinsert only the approved Owner/basic references**. It is not row deletion or a financial reversal. The PostgreSQL database/project/connection remains the same; no new cloud database or Render target is needed. No user trigger/RLS/constraint disabling or TRUNCATE is used. The hosted DDL path is deliberately absent from the current executable and requires explicit approval before activation/execution.
4. Remove ONLY the final approved non-Owner Auth identities using supported Supabase Auth Admin APIs, and ONLY approved business object keys through Storage APIs. Do not delete managed Auth/Storage schemas, delete a bucket, clear its metadata with SQL, or delete backup/control prefixes. Validate Owner and scope at every phase. Local PostgreSQL recreation alone is not this cleanup.
5. Rehearse provider deletion and recovery with the application rebuild as one coordinated process. Validate real Owner reauthentication and post-reset login without exposing/storing the password, runtime TLS/RLS, empty business counts, object removal, and normal UI create/reopen. Full current-request end-to-end validation is **not yet complete**.
6. Persist completion/failure/reset audit outside the replaced schema. On any failure keep maintenance active, never announce success, never resume ordinary writes into a partial state and never retry destructive steps blindly.

Until those gates pass, the actual old-database reset is **not ready**. Do not request final execution consent based only on the passing application-schema rehearsal.

## Rollback plan to complete/test before execution

Keep service URL, source project, runtime role/password, encryption keys and Owner Auth identity unchanged. Retain previous app SHA and encrypted full archive + documents + metadata. Under maintenance, restore approved application schema/data and ledger from the archive, recover any removed non-Owner Auth identities using a supported hash-preserving import (never plaintext passwords or old refresh sessions), and restore object bytes by original keys with digest checks/no silent overwrite. Validate Owner, roles/RLS/constraints, balances and original references before releasing maintenance. Hosted managed-provider recovery and that coordinated worker procedure are not yet tested; local full-dump restoration proof must not be described as hosted provider recovery success.

## Future production

Reuse the same maintained code and the latest full approved forward-migration manifest, including every future enhancement. Preserve trial rows across development updates. Build a **new clean production installation** from schema plus reviewed neutral configuration/roles, not trial transaction history, and rehearse backups, Owner provisioning, acceptance and rollback separately. Never execute destructive Reset against an existing production database. If protected trial history cannot be removed by supported procedures, the honest supported production path is clean schema provisioning under independent future resource/cutover approval, not a trigger bypass. Deferred comprehensive auth/legacy-password/security review remains mandatory before production.
