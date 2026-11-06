# Company status visibility and shared search layout

## Diagnosis

The company register initialized its Excel state with `status: ['Active']`.
Deactivation already performs a revision-checked status-only PATCH; the server
records changed fields in the company audit log. A refreshed register consequently
hid inactive companies because of the implicit Active-only filter.

The owner's corrected company name was investigated against the pinned existing
Supabase test project using verified TLS and a read-only transaction. Both Arabic
and English names were checked with Arabic spelling normalization. Exactly one
match exists, with status Inactive and revision 2; audit entries containing status
and related rows remain present. The implicit Active-only filter excludes this row.
No existing record was changed or reactivated. Diagnostic run:
https://github.com/dubai717/ab-group-demo/actions/runs/42210299979
The diagnostic branch is separate from the application release.

## Fix and scope review

- Default company grid has no implicit status selection; all authorized statuses
  remain visible. Explicit Excel status selections remain available and respected.
- Existing named confirmation, permission checks, revision checks, audit, profile
  opening and Activate action are preserved. No server mutation logic was changed.
- Customer/vehicle grids start without a forced status; bank and user registers
  also default to all authorized statuses. Personnel default state is empty.
  Explicit user filters and operational Active-only assignment/recipient selectors
  are intentionally preserved, as are closed-account rules and login protections.
- One shared search layout handles direct inputs and existing wrapped field forms.
  Workspace enhancement applies it to legacy vehicle/customer/user register forms;
  data-entry forms and search handlers remain unchanged. Search buttons do not
  shrink or wrap; the input takes the remaining width. Export action order remains.
- No database, credentials, privileges, Reset or deployment policy changes.

## Verification

Isolated PostgreSQL/API tests cover default all-status listing, explicit Active and
Inactive filters, profile reads, status persistence, linked customer preservation,
status audit events, unchanged role catalogue and denied unauthorized status edits.
The browser lifecycle covers create/deactivate/stay visible/open inactive profile/
reload/reactivate/reload and existing bank failure/retry/readback checks.
Shared component layout tests cover direct and wrapped forms, Arabic/English and
390/768/1440-pixel viewports, with unchanged Excel/PDF/Print order.

Hosted diagnostic and post-release smoke are read-only; synthetic business writes
occur only in the isolated local/CI fixtures, never in the existing Supabase data.
