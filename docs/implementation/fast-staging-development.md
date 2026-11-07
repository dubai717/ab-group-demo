# Fast staging development (owner decision)

## Actual failure

Protected run 42413520815 (#12) restored the encrypted backup and 97 encrypted
objects successfully. All twelve migrations014–025 passed on that actual restored
copy. The live transaction then stopped in VERIFY_MIGRATED_STATE with SQLSTATE
42501. It rolled back and release was skipped. Earlier login/logout drift was
correctly diagnosed, and is not evidence for the final error in this run.

The checker previously required the hosted migration operator to SET ROLE
ab_runtime. That operator membership is separate from actual runtime access;
the old eight-migration schema-diagnostic already documents this failure mode.
The new read-only readiness job reports the operator SET capability and verifies
real scoped runtime reads, without widening membership or user grants.

## Two paths on the same existing Render/Supabase target

1. Ordinary release, no pending SQL: successful exact candidate CI, ordinary
   classification, read-only TLS/project/ledger/runtime/constraints/balance checks,
   reset-idle guard, then exact-commit Render deploy and live UI/authz smoke.
   No full hosted backup/restore drill, migration or manual SHA update.
2. Pending014–025: native owner gate remains; fresh retained encrypted backup,
   actual isolated restore, exact ordered migration rehearsal, strict financial/
   business/grant equality and correlated audit/session continuity, transactional
   application and actual runtime reads. Failure blocks release. No reset,
   deletes, fallback data patching or secret changes.

The read-only readiness job runs independently of the native owner gate to avoid
blocking diagnosis. The ledger is read again immediately before choosing the
fast path, so an old result cannot waive a newly pending migration. Unknown or
sensitive code still follows the existing owner gate. No GitHub protections,
reviewers, environments or secrets are modified by this change. No expanded
security audit or new service is introduced; comprehensive pre-production
security review remains a separate milestone.

## Correct runtime verification

The restored clone still uses SET LOCAL ROLE to validate new RLS before any live
DDL. Live reads use the existing independent DATABASE_URL directly as ab_runtime
(read-only transaction, no impersonation). Current tables are read before live
DDL. New-table SELECT grants, existing grants/roles/RLS/functions, rows, balances
and relationships are checked before committing. New tables are invisible to a
second connection until commit; actual scoped new-table reads run immediately
after commit. Any post-commit runtime failure blocks deployment and reports
COMMITTED=true; it does not delete the approved additive schema. The next action
must inspect the ledger, never blindly reapply or perform destructive rollback.

## Verification

17 isolated PostgreSQL cases passed, including a migration operator that rejects
SET ROLE with42501 while the independent runtime succeeds, a read-only complete-
ledger fast path that changes nothing, concurrency, finance/grant drift refusal,
rollback and original row/balance/grant preservation. Unit policy tests verify
ordinary backup skipping, current-ledger recheck, no privileged backup/storage
secrets in the readiness job, and retention of the native owner gate. TypeScript,
module-graph build and source-integrity checks remain required.

## Preserved application release

The application source remains f15daefd3796679d19fc0e01ff3acb679745b937 with
successful exact push CI42377186819. This change only replaces the immutable
controller and protected-main entry. It does not falsely claim that candidate CI
or an isolated rehearsal means Render has been deployed. Final success requires
matching live release/project/app hashes and opening the actual sidebar/pages.
