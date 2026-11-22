# Financial completion build — deployment hold

Owner instruction received 21 November 2026 supersedes the earlier per-PR deployment cadence.

- Continue implementing and testing the 95-requirement order on development branches.
- Do **not** merge work into `staging/ab-group-test` or request another protected delivery while the combined financial package is incomplete: pushes to that branch launch delivery automatically.
- Existing PR112 delivery and PR113/114 checks are left untouched. Do not cancel, approve, rerun or supersede them because of this document.
- New PRs may preserve/review code; use a draft cumulative completion PR and keep it unmerged until all acceptance criteria and substantial financial/legal decisions are resolved.
- No Render changes, Production operations, original Supabase writes, balance migrations, Reset or Restore during this build.
- Once all 95 requirements and comprehensive acceptance are complete, prepare one immutable release candidate and seek the single mandatory Owner deployment approval.

This is a workflow instruction, not a modification or bypass of the protected GitHub controller. No controller or environment protection has been changed.
