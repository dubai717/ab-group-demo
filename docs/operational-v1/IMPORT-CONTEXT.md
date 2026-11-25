# Original import late-response context

The original customer/vehicle importer and company preview share a guard over actual actor, CSRF, original authority revision, locale and currentPage. The non-enumerable read-only authorityVersion getter exposes only the existing transport revision, not a grant or permission. API responses are checked before assigning a job/preview, downloading a file or displaying a result; obsolete dialogs close. Same-context network errors retain files/source/company/format as before. Changes of actor/authority are not ordinary retry failures and do not keep a previous user dataset onscreen.

This corrects the original actor-only check and the company preview's incorrect page property. Selecting another company source file removes the previous preview. No new polling or permission mechanism is added.

The actual browser test holds original server previews for customers, vehicles and companies through page, CSRF, locale and mocked bootstrap-authority transitions. It performs no target import or real authority write. Original CSV retry and company-preview AR/EN1440/768/390 journeys passed again. Complete41-journey operational acceptance passed exit0; releaseReady remains false.
