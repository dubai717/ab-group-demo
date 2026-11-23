# Original dashboard indicator selection — unpublished

The existing dashboard-rights editor now previews actual numeric indicator cards
from the Owner reviewer's last authorized dashboard scope. Opening the editor or
pressing +/× does not read all sources again. A single explicit refresh uses the
existing dashboard API for every card, with a bounded timeout, actor/session/locale
checks and honest unavailable states. Regular mutation invalidation stays intact.
No employee data is projected under the reviewer's identity. The preview names its
scope and timestamp; missing or unauthorized counts are not invented zeros.

The job-standard editor stages these same original role dashboard controls, including
before the first save, and saves them atomically with the standard after final review. Adding a card does not enable opening its
details, assign an employee, or create underlying data authority. Removing it also
removes its detail permission. Original plan/confirmation/version/Owner checks are
retained. Cancel, discarded refresh errors, and busy close preserve draft choices.
Security dialogs use the existing record change tracker and a shared close guard,
including floating header × and beforeunload; original role payload stays strict.

Acceptance: `backend/tests/dashboard-indicator-preview.browser.cjs` exercises real
Owner and denied-reader sessions, cached exact counts, one shared explicit refresh,
failed-read draft retention, +/× without automatic drill-down grants, saved-standard
entry, unsaved-standard draft staging and atomic confirmation, no user assignment and AR/EN at 1440/768/390.
The standalone and operational suite each use a fresh synthetic fixture.

Still incomplete: actual table/chart previews and full individual widget inheritance,
selective individual exception reset, inherited deny and geography acceptance.
This work does not complete requirement 3.3 or authorize deployment.

Atomic before/after review, stale snapshot refusal, rollback and same-receipt recovery are documented in ATOMIC-STANDARD-DASHBOARD.md. Existing individual dashboard overrides are retained.
