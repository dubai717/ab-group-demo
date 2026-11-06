# Register search and filtering

All new record lists use one central search and column popovers from `RegisterTools`. Do not add independent top-level status/company/date filters. Operational inputs for creating transactions, selecting a report's accounting scope or configuring a payroll run remain operational inputs.

* Server-backed/paginated registers use `/api/registers/:kind` and `RegisterStore`, with authorized source rows selected before search/facets. Company, customer, vehicle and bank registers share the same exact filter/sort semantics for navigation and export.
* Complete authorized snapshots use `RegisterView.select` and `RegisterView.bind`; never feed a partial page into this adapter while claiming a full-register result. The user and personnel adapters retain their existing source authorization.
* Version 2 stores explicit empty selections as “none”; legacy unversioned empty arrays retain their old “all” semantics. Column conditions have server-authoritative types. Numeric comparisons retain decimal precision; search folds Arabic/Persian digits and common Arabic letter variants.
* Use stable actor-specific state, retain state on profile return, clear it on logout, and keep action cells out of value filters. Actual values only, no invented options or financial aggregates.
* Popovers are portalled under their heading and remain usable inside horizontally scrolling tables, with outside-click/Escape dismissal and RTL positioning.
* Financial workbench and ledger registers now use `FinancialTables`, sharing the same column engine. Their authorized source readers are complete up to the explicit 20,000-record safety limit and fail rather than truncate beyond it. Sources above 500 rows filter on the server through the authorized read-only `register-view` endpoints. Report filters run before pagination and full export; legacy API callers retain their old default page behavior. Transaction-company selection and accounting report definitions remain operational inputs, not independent register filters.
* Financial forms and posting/approval callbacks are reused. Table refresh does not replace forms or file inputs. Voucher/custody selection survives pagination and is cleared when a search/filter changes, preventing hidden old selections from being processed accidentally. CSV/Excel/print recheck existing export/print permissions on the server and retain currency. No posting formula or authority definition changes.

Tests: `tests/register-tools.test.cjs`, `backend/tests/registers.integration.test.ts`, `backend/tests/register-lifecycle.browser.cjs`, `backend/tests/workspace.browser.cjs`, and `backend/tests/workspace-components.browser.cjs`, `backend/tests/financial-registers.test.ts`, and `backend/tests/financial-registers.browser.cjs`.

No database migration, role changes, secrets or live fixture insertion accompany these UI changes. The previous account-specific lookup was cancelled; no lookup secret or record-specific diagnostic is included.
