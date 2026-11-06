# Staging delivery policy — operational verification

The existing AB Group staging service is https://ab-group-demo.onrender.com. It remains connected to the original test project. Production deployment is outside this policy.

Successful checks on staging/ab-group-test automatically trigger the protected main dispatcher. Ordinary recognized changes do not require editing STAGING_SENSITIVE_APPROVAL_SHA. Sensitive or unclassified changes require approval by the sole owner through staging-owner-approval. Candidate application code never executes alongside provider secrets in delivery jobs.

Main updates are restricted to repository administrators. Provider jobs bind the existing supabase-test environment directly and execute deployment tooling from a pinned controller commit. Secret values are never emitted into logs, artifacts or source files.

Every actual release requires a fresh encrypted backup, a successful isolated restoration, immutable schema verification, exact tested-commit delivery and read-only hosted smoke checks. Deployment records include source commit, test run, prior release and final result; tests alone do not prove publication. Code rollback requires compatibility review and never automatically restores or deletes data.

This documentation-only commit is the ordinary-release smoke test. It changes no application behavior, database, permission grant, credential or Reset setting. Its success is established by the GitHub deployment record and the live /api/release commit, not by this document.
