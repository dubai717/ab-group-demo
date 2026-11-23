# Existing delegation linked to approved leave — unpublished

The existing authorized HR employee profile opens the original delegation form.
Optional approved-leave selection fills UAE dates. The same hr_delegations row
stores a linkage version/digest. There is no new task, role or delegation table,
and no historical backfill. Unlinked legacy behavior stays Owner-reviewed.

The API verifies employee/company/approved-leave identity, bounds, substitute's
active linked account/work assignment, overlapping absence/delegation, duplicate
IDs and original task scope. Current adapters support manual and employee-document
tasks and original case-linked conversation tasks with existing participant/source authority. Financial/custody sources are rejected; signing, payment, final approvals
and financial liability are not transferred. Different-key repeats recover the
same source. Current followup rechecks sources and assigns each task once.

Expiry or confirmed return returns open work only if its latest assignment still
belongs to this delegation. Completed work stays with its actual substitute and
explicit external reassignment is preserved. Uncertain assignment rolls back the
whole attempted source return. Report alone does not transfer work; the original
return approval and independent immutable access proof remain required. The early
return test models a separately approved adjustment in its isolated fixture only.

Delegation reconciliation never changes accounts, grants, leave balance, money or
financial authority. An account still awaiting return confirmation or independently
blocked stays restricted; returned open work receives management followup. Reviews
reuse original leader notifications and immutable audit, deduplicated by source
and reason, without creating personal oversight tasks on the Owner. Followup shows
returned-task/review counts. Task clock adoption after reassignment remains review.

Rejected input stays in the form with localized field feedback and a trace. When
save commits but display refresh fails, the committed result remains, inputs lock,
and Reload saved result refreshes without another POST or false dirty warning.

Restored-source acceptance: TypeScript, 182 static/delivery checks, 75 combined
native cases and 13 independent browser journeys passed, with synthetic PostgreSQL,
Auth/Storage only. AR/EN at1440/768/390 covers bounds, committed refresh recovery,
original task identity, concurrent dedup, actual return, completion attribution,
unchanged Pending account/grants/journals, overlap/financial refusal, atomic review
and notification dedup. Evidence hashes and exact log tails are in ACCEPTANCE.json;
local paths can expire, and CI must independently pass on the eventual head.

Remaining: other source adapters, cross-company coverage, substitute-leave actual
start/return continuity, bulk distribution, clock adoption, full self-service and
unlinked message/attachment contributions. Requirement4.b and the whole release
remain partial. No hosted SQL or protected financial worktree was modified.

Case coverage adds no participant or grant. Creation, activation and linked explicit return recheck current source rights. Pending original accounts require management review instead of automatic case-task return; verified return restores only previously held access through the original independent proof. See COMMUNICATION-CASES.md and communication-leave-delegation.test.ts.
