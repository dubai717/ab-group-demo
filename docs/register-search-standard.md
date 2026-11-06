# Register search and filtering

All new record lists use one central search and column popovers from `RegisterTools`. Do not add independent top-level status/company/date filters. Operational inputs for creating transactions, selecting a report's accounting scope or configuring a payroll run remain operational inputs.

* Server-backed/paginated registers use `/api/registers/:kind` and `RegisterStore`, with authorized source rows selected before search/facets. Company, customer, vehicle and bank registers share the same exact filter/sort semantics for navigation and export.
* Complete authorized snapshots use `RegisterView.select` and `RegisterView.bind`; never feed a partial page into this adapter while claiming a full-register result. The user and personnel adapters retain their existing source authorization.
* Version 2 stores explicit empty selections as “none”; legacy unversioned empty arrays retain their old “all” semantics. Column conditions have server-authoritative types. Numeric comparisons retain decimal precision; search folds Arabic/Persian digits and common Arabic letter variants.
* Use stable actor-specific state, retain state on profile return, clear it on logout, and keep action cells out of value filters. Actual values only, no invented options or financial aggregates.
* Popovers are portalled under their heading and remain usable inside horizontally scrolling tables, with outside-click/Escape dismissal and RTL positioning.
* Remaining legacy financial snapshot/report adapters must not silently apply full-register search to their 200/500-row snapshots. They require server-level adapters before claiming compliance with this standard.

Tests: `tests/register-tools.test.cjs`, `backend/tests/registers.integration.test.ts`, `backend/tests/register-lifecycle.browser.cjs`, `backend/tests/workspace.browser.cjs`, and `backend/tests/workspace-components.browser.cjs`.

No database migration, role changes, secrets or live fixture insertion accompany these UI changes. The previous account-specific lookup was cancelled; no lookup secret or record-specific diagnostic is included.
