# Proposed staging approval policy — awaiting owner review

This is a proposal only. It does not change the current workflow, classifier,
STAGING_SENSITIVE_APPROVAL_SHA, environment protection, secrets or deployment settings.

## Ordinary staging releases

A change proven to be an ordinary presentation or application fix may deploy to the
existing, pinned Render test service after required tests and security checks pass.
No per-release SHA variable edit would be required for this class. The reviewed
classifier must compare the complete diff to the last successfully deployed commit.
It must use a narrow allowlist plus behavioral/contract checks, not infer safety
from a filename or absence of dangerous keywords. Unknown or mixed changes block
automatic deployment and require review.

## Explicit owner approval

Deletion, Reset, secret operations, authentication/authorization changes, permission
changes, sensitive schema/data migrations, financial posting changes, and production
releases retain a protected approval gate. Use a protected deployment environment
with owner review bound to the exact commit/run/artifact, rather than a manually
copied SHA variable. A PR must not approve its own classifier or workflow change.
Prevent self-approval and concurrent deployment to the same target. Expired or
changed evidence invalidates approval. Production remains independently protected.

## Evidence and rollback

Keep the version SHA, classification and reason, test/security results, target
identity, deploy status and post-deploy health/smoke checks for every release.
Before permitted migrations, verify an encrypted backup and isolated restore.
Keep the previous deployable application artifact/version. Application rollback
must not run down-migrations or delete data; data restoration requires separate
approval. Failed tests, missing backup evidence, conflicts, uncertain classification
or wrong target block the release.

## Changes needed only after approval

1. Add tests for ordinary, sensitive, unknown and mixed diffs, including classifier
   tampering and wrong-target attempts; test the proposal in non-deploying mode.
2. Configure protected high-risk approval and reviewed classifier inputs.
3. Replace only the ordinary-release SHA requirement, retaining all existing
   authentication, target pins, tests, backup/restore and release evidence checks.
4. Verify blocked paths cannot deploy, then enable the new staging-only policy.

No implementation or settings change is authorized by this document.
