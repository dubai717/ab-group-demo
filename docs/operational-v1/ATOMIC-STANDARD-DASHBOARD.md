# Atomic job-standard permissions and dashboard restrictions — unpublished

The original standard editor can stage actual dashboard indicators before the first
save, alongside names, position linkage and granular permissions. The existing
indicator editor and reviewer-scoped previews are reused. Its draft action performs
no configuration write. The final original standard review shows before/after
indicator, detail, panel, company and unit choices and the affected permission changes.
No employees appear during design, and linking a position assigns no account.

The existing security-role plan/apply accepts an optional strict dashboard draft.
Both writes run in the same original transaction. Its plan digest binds the exact
role revision, original permission/grant version, dashboard snapshot version and
normalized proposed restrictions. The apply route takes the same role and dashboard
locks as the original routes. A later standalone widget change invalidates the whole
plan; it cannot leave partially saved permissions. A failed dashboard write rolls
back the role write. A lost successful reply reuses the original idempotency receipt,
so the role revision and restrictions are saved once. Individual dashboard overrides
and permission additions remain intact by default. Existing selected-removal rules
and original reviewed DB procedures continue to apply; no new hosted SQL is needed.

The public base dashboard stays available. Indicators and drill-down choices remain
restrictions on current domain/RLS authority, never grants of data access. Removing
a widget also removes its detail checkbox, while adding one does not grant details.
Actual preview counts identify the reviewer's existing authorized scope and timestamp;
no employee or financial preview is fabricated. Draft cancellation and technical
failure retain inputs. Normal standalone dashboard administration remains available.

Evidence: 12 focused native role, dashboard, standard and exception checks passed;
a further native acceptance uses an actually assigned employee with a retained direct
grant and individual dashboard override. These overlap earlier evidence. Synthetic
fault injection proves both writes roll back, and stale dashboard state is refused.
The original UI tests and a new AR/EN journey exercise first-save staging, actual
before/after review, one committed version despite a lost reply, no account assignment
and no false unsaved-change warning at 1440/768/390. Final log hashes are in ACCEPTANCE.

Still partial: inherited individual denies, geographic scope, explicit add/deny widget
inheritance and selected override reset, table/chart previews and complete acceptance.
A stale saved dashboard version is never overwritten automatically; the Owner must
review the current source before a new confirmation. This package does not complete
all of requirement3, the financial95 checklist or the first operational release.
No merge, deployment, hosted data change or financial activation is authorized here.
