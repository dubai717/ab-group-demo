# Verified register updates, navigation and dashboard details

Base: staging/ab-group-test f15daefd3796679d19fc0e01ff3acb679745b937.
That release and migrations014–025 were verified deployed by protected run
42415451817; this change introduces no SQL or server permission changes.

Company status previously mixed bootstrap reload, an automatically drawing
register refresh and a conditional final render. These asynchronous render paths
could replace controls during interaction or leave a profile dependent on a later
navigation. The transition now updates the canonical row from verified server
readback, refreshes the permission-scoped register without auto-drawing, then
performs one final render while retaining the current page/profile. The busy
guard disables repeated actions; failure retains the last verified status. Existing
server permissions, optimistic revisions, audit encryption/redaction and records
are unchanged. Dashboard counts invalidate after successful API mutations.

The bank editor's module-local selected ID previously survived sidebar navigation.
Sidebar bank entry now explicitly selects the accounts register and clears only
editor/preview state. Existing server save/readback and duplicate-safe retries
remain. Shared RecordProfile draft snapshots protect bank/company creation forms;
sidebar/toolbar/close actions allow cancelling navigation. A new shared navigation
guard reuses customer/company protections. No draft is persisted to browser storage.

Dashboard cards use the existing stat-label/stat-value layout. Full scoped counts
are retained while a separate scoped source request retrieves details. Explicit
localized column definitions replace Object.keys-generated technical headers;
UUIDs stay internal. Company licence and bank labels reuse already authorized
bootstrap records matched to authorized source rows. CenterForms.table and
RegisterView retain search plus Excel filter/sort state. Rows open existing
company/customer/vehicle/contractor profiles, or a read-only projection with a link
to the original permission-checked module. Back preserves dashboard scope/dates
and source query/filter state; searches clear on actor changes.

Verification uses only local synthetic PostgreSQL/providers: company status and
failure/reload, original readonly profile, bank close/navigation/discard/cancel,
verified create/reopen/reload, actual scoped dashboard counts, localized headers,
search/return, and English desktop/Arabic phone plus tablet sizing. The new browser
suite is invoked by the existing business-centers browser CI step; no workflow or
service configuration is changed. Existing register integration tests also verify
independent permissions, redacted server audit and preservation of role grants.

Deployment follows the existing protected staging policy. A successful local test
or CI is not proof of deployment: verify the exact live release/app/project and
post-deployment smoke. Any existing mandatory owner gate is retained, not bypassed.
