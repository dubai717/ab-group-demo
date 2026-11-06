# Protected staging delivery v2

Status: prepared; activation requires GitHub protections below. Until preflight verifies them, deployment is blocked. No secrets, grants, business records or connection settings are changed by this work.

## Trust boundary

Source branch `staging/ab-group-test` runs isolated checks only. It cannot access provider credentials. A small default-branch entry invokes a reusable controller pinned to an immutable commit. The controller parses candidate code as data and never imports candidate JavaScript or installs candidate dependencies in credential-bearing jobs. Required source-check workflow hashes must match the reviewed controller copies.

The existing `supabase-test` environment must allow **only the branch `main`**. A separate `staging-owner-approval` environment contains **no secrets**, requires reviewer `dubai717`, disables administrator bypass, and allows only `main`. A main ruleset must be active, restricting updates, deletions and force pushes; only repository administrators may bypass. Preflight checks the actual GitHub API settings, not merely this document. Unreadable protections stop delivery.

Existing manual default-branch workflows accessing `supabase-test` also need the owner-approval job before their privileged jobs. Do not activate until all of these are gated. Source workflows on other branches cannot access the environment after the main-only restriction.

## Classification

Parsed presentation text/markup and validated local CSS can deploy automatically. Security-related files, dependencies, backend code, permissions, deployment configuration and raw SQL require owner approval. Unknown syntax, new runtime modules, altered execution paths, unrecognized changes and ambiguous classifications also require approval. Credential material and symlinks/submodules are blocked outright. Moving a privileged button outside its condition, changing API URLs or adding network/mutation code cannot qualify as presentation-only.

This intentionally favors false positives over an unsafe deployment. It does not claim to prove arbitrary program semantics. Future non-sensitive changes outside recognized contracts require a controller review before becoming automatic.

A sensitive approval is tied to a GitHub run and exact source commit, not a mutable SHA variable. `STAGING_SENSITIVE_APPROVAL_SHA` is not read by v2; leave the existing variable untouched.

## Delivery and recovery

1. Successful same-repository push checks on the exact current staging head.
2. Protected controller preflight, pinned Render/Supabase identity and previous live release verification.
3. Owner environment approval for sensitive/unknown changes; ordinary changes skip it.
4. Existing fresh encrypted create-only backup and actual restoration in an isolated runner PostgreSQL instance.
5. Immutable migrations 001–013 and existing additive schema validation; this activation performs no migrations. New additive declarations currently stop for controller review rather than guessing whether they are harmless.
6. Exact tested source commit submitted to the existing Render hook; wait for matching version, app hash, health and GET-only live/browser smoke.
7. GitHub deployment record includes source, prior release, controller and source test run. Classification is retained as a 90-day artifact. Failure never records success.

No Reset, destructive cleanup, credential changes, grant edits or production deployment is implemented by this pipeline. Owner approval is necessary but does not itself execute those operations; each needs its dedicated reviewed procedure.

If a new release fails after deployment, keep the encrypted backup and failed deployment record. Stop subsequent automatic releases when live version differs from last successful release. An owner must approve a rollback of code to the recorded previous release after compatibility review (especially stored permission overrides). Never run down-migrations or restore data automatically to roll back code. The existing Render service supports deploying a previous commit without changing its database connection; this is a separate owner-approved recovery, not an untested automatic rollback.

## One-time activation

Prepare a workflow-only main PR installing `staging-delivery-dispatch.yml` pinned to the reviewed control commit, and gating legacy privileged workflows. Do not merge application branches into main for this. The control commit's `trust.json` may authorize exactly one source tree approved by the owner for the bootstrap; any other tree still goes through classification/approval. Null bootstrap is fail-closed.

Configure the two environments and main ruleset before merging the workflow-only entry. No secrets need to be copied, read, replaced or deleted. Render Auto-Deploy stays Off; only the checked hook delivery is allowed. Existing main GitHub Pages publishing must remain inactive.

The entry listens to successful source-check workflow completion and supports a manual retry resolving the latest successful checks on the unchanged staging head. The entry itself is an owner-controlled trust anchor. Updating the immutable controller is a sensitive, reviewed operation.
