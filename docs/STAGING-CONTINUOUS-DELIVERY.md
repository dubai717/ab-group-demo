# AB Group — controlled test delivery

Target: the existing https://ab-group-demo.onrender.com service and ab-group-erp-test. The owner confirmed development-only use, and the read-only Render Shell probe confirmed the runtime connection matches the protected test-project fingerprint. Reviewed core rows matched the known fictional fixtures. Any records remain protected regardless of their content. No production activation is authorized.

## Completed foundation

001–013 are now applied to the test database. Approved 009–013 were rehearsed on an actual restored hosted snapshot before atomic application. Old rows, role assignments, grants, original policies and original functions were checked inside the transaction; foreign keys, RLS and real runtime/Owner access passed. The release is recorded at https://github.com/dubai717/ab-group-demo/actions/runs/41803883682 . The initial activation workflow must not be rerun blindly: it deliberately refuses a ledger already containing 013.

Fresh encrypted pre-migration backups and encrypted sidecars remain in ab-private-test without overwriting earlier copies. Keys are kept separate. Nothing is uploaded to public Actions artifacts. These backups are in the same Supabase project, not an independent provider backup.

## One-time delivery connection

The existing Render service's native Auto-Deploy must be Off. GitHub Actions will perform success-gated automatic deployment. This avoids deploying merely because a branch moved.

The owner must copy the EXISTING Deploy Hook from that service, without regeneration, into the existing GitHub Environment supabase-test as RENDER_DEPLOY_HOOK. Never paste it into chat or commit it. It is a deploy-only secret, not a broad Render administration API key. Before first use, compare its path fingerprint to the owner's independently supplied Render service ID and pin the matching hash in backend/deploy/staging-target.json. A null or mismatched binding fails closed. Do not replace any existing Supabase/key secret or change paid services.

The initial foundation publication preserves main and uses an independently reviewed/tested PR into staging/ab-group-test. GitHub Pages remains on GitHub Actions without any Pages publisher. No new Render service or database is created.

## Normal cycle

1. Implement the requested ordinary change on a development branch; add meaningful tests and open a PR to staging/ab-group-test. PR jobs have no cloud secrets.
2. After review/classification, merge the ordinary change into staging. This moves only the test branch; main/production promotion remains separate.
3. The controlled staging workflow runs the complete existing suite. Its policy compares the commit with the last SUCCESSFULLY verified GitHub staging deployment, not merely the previous push (so a failed sensitive change cannot slip through a later ordinary commit).
4. A pinned-target job validates immutable SQL history, rejects untracked tables/known enabled production integrations, captures a new create-only encrypted backup, downloads/restores it to ephemeral PostgreSQL 17 and verifies data, constraints, RLS and encrypted documents.
5. Only declared safe additions in supabase/additive/*.json may be applied automatically, first to the clone and then transactionally to the test source with preservation checks. No raw SQL is treated as automatically safe.
6. The deployment job has no checkout or build and receives only the deploy hook and repository deployment-record token. It pins the exact tested SHA and verifies the live /api/release commit, staging environment, project fingerprint, health and frontend hash.
7. A separate live smoke job creates NEW fictional fixtures in a separate tenant, checks real Auth login and rejection, company/bank/relationship-manager persistence, cross-tenant denial, Render data-key compatibility and module availability, then tests Arabic/English desktop/mobile login without JavaScript errors or sensitive browser-storage writes. Existing Owner records/passwords are untouched. Test records are retained, not deleted.
8. Only successful live smoke marks the explicit nonproduction GitHub Deployment successful. Its payload records the previous code SHA; failed/secret-gate-only runs are never counted as successful website publication.

## Approval gates

Financial/permission policy, authentication/server control, applied SQL, package/deployment-control changes fail the automatic policy unless the owner explicitly approves that exact commit. A protected Environment VARIABLE (not a password) STAGING_SENSITIVE_APPROVAL_SHA may hold the exact approved SHA; rerun that same staging workflow after approval. It cannot approve a different future commit. The path gate is conservative, including shared server files containing authorization logic.

New raw SQL, destructive operations, edits to applied migrations, user/role/grant changes and complex schema transformations require a separately reviewed migration plan even with program-code approval. Automatic JSON is limited to nullable custom_ columns of simple types or nonunique plain indexes on an allowlist. No SQL expressions, defaults, NOT NULL, unique constraints, money posting-table edits or deletes are accepted.

A project/target mismatch, unknown ledger/table, production integration flag, source change since backup, unreadable backup, failed tests/preservation, missing hook, unexpected live version or failed smoke blocks publication. No automatic schema rollback/drop, credential rotation, service purchase or production deployment occurs.

## Recovery and limits

Render preserves prior deployments. For a failed build its last healthy version stays available. For a functional regression, stop further promotion and obtain approval to roll back to the previous verified software SHA (recorded in the GitHub Deployment / Actions run) on the SAME service. Keep the additive database in place; never automatically run destructive down migrations. Restore data only under a separate explicit restore plan, considering writes since the backup.

Backups and real synthetic fixtures accumulate without automatic deletion. Archive size is bounded; storage/quota failure stops releases instead of buying a plan. No independent nightly schedule or off-provider custody is claimed. Private archive access, old key custody and any future retention cleanup require owner administration. OCR, WhatsApp, live GPS, advanced reports and the real malware scanner remain subject to their existing activation limits; files stay quarantined until the real scanner is configured.
