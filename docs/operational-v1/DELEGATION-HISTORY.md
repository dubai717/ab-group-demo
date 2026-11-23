# Original-source substitute activity — unpublished

Read-only `/api/personnel/delegations/:id/history` reuses hr_delegations, tasks,
immutable hr_task_events and actual employee/account identity. The existing HR
administration register opens its compact AR/EN view and permitted original task.
Participants may read their source history; company task managers/delegators need
that exact company authority. Other-company authority grants no access. Underlying
task opening uses the original task authorization separately.

Actions are bounded by a recorded matching transfer, next reassignment, actual
completion timestamp and the recorded delegation end date. Missing transfer is
not invented. Ambiguous simultaneous assignment events require review. Timestamp
comparison retains PostgreSQL milliseconds. Completion attribution requires an
actual substitute submission and completed source task; managerial approval is
shown under its actual actor, and no completion is attributed to the original
employee. Task action counts and completed-after-submission counts are distinct.

The view does not restore tasks, reopen completed ones, change permissions, post
money or create performance facts. Notes are escaped; raw IDs and cipher payloads
are not printed. Bounded original reads, explicit errors/references and stale
actor/company/admin/locale checks protect the UI. No polling is introduced.

Acceptance drives the original delegation, substitute start/submit, independent
review and Owner return. One completed task stays with its actual substitute and
one open task returns through the existing source route. Source states, immutable
events, grants and journals remain unchanged by reads. Unauthorized cross-company
access is rejected. Original HR plus history: 56 tests passed. Browser AR/EN at
1440/768/390 proves no credit for Owner actions, human failure/retry reference and
suppressed late-language response.

Remaining: explicitly leave-linked automatic return/reassignment, complete self
service entry and unlinked messages/attachments. This is not the complete leave
coverage workflow, and no hosted data or protected financial worktree was changed.
