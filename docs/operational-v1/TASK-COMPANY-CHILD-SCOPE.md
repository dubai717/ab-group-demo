# Task company and child history boundary — review candidate only

`company-scope-task-children.sql` is not installed or included in migration manifests. It adds restrictive company scope to the original tasks and parent-bound scope to immutable `hr_task_events`. Existing tenant, work-hold, source, assignment and API action checks stay in place; no grant, task, history or membership is rewritten. An employee's primary employer is not used to substitute for the task's legal company.

An explicit empty work scope hides work tasks/history while the separately reviewed original employee self-identity rule remains available. This does not grant work access through the return portal. Unknown actors and foreign tenants fail closed. Runtime stays non-superuser/non-bypass. Original immutable history retains its original protections.

The actual original fixture/API and direct SQL tests cover one-company/empty/Owner/unknown/foreign-tenant cases; same-company SQL update works while a company transfer is refused; original parent history INSERT is scoped and UPDATE/DELETE stay denied; API foreign task/detail/create remains denied; original task/employee/grant/journal/receipt hashes remain unchanged.

A failed fixture attempted to grant legacy `view_tasks` through the newer grant-action API; the original policy correctly refused it. The test now uses the existing employee role and original action checks, without any production permission change.

This is a narrowing candidate, not complete task-source authorization. Special private/investor task payloads, delegated/cross-branch custody tasks, source-specific task authority, original membership application, complete compiled policy coverage, rollback and final action/report/export acceptance remain engineering work. No readiness fingerprint was repinned and `canApply=false` remains mandatory.
