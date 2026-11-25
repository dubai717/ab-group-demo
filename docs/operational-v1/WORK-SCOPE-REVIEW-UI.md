# Owner work scope review in original employee permissions

The existing employee permission screen now opens a compact read-only scope preview using the existing `/api/users/:id/work-scope/preview` endpoint. The Owner can choose explicit companies, dated recorded centres, recorded emirates or all group companies. Centre facts are loaded only on explicit selection; there is no polling or inferred centre/company mapping. Primary work location remains separate.

The comparison uses saved permissions and original server facts. It displays current/proposed/added/removed companies, retained individual exception counts and original action-policy simulation counts. No apply or grant button is offered; the server still returns simulationOnly and canApply=false. This does not complete actual company-scope application, cross-branch access or source-level enforcement.

The dialog preserves staged original permission edits, keeps selection on a failed request, and discards late actor/employee/language/authority responses. Closing or changing target disconnects its observer. It contains no role-standard employee picker, technical SQL output or user-visible UUID labels. All earlier matrices and work-location/centre editors remain in place.

Evidence: `backend/tests/work-scope-review.browser.cjs` passed actual Arabic/English1440/768/390 flows for companies/group/dated centres, request failure/retry, retained unsaved customer-create permission checkbox and a late response after changing employee. Before/after original user, grants and denials are unchanged; every observed POST is the original read-only preview. Four original native readiness/preview/inventory cases passed,189 root regressions and provider-free build passed. The operational browser suite now includes46 journeys; its full current-source run is tracked separately and is not implied by the focused result.

Synthetic screenshots are under ignored `work/evidence/work-scope-review-{ar,en}-{1440,768,390}.png`; no actual customer or employee data was captured.

The full46-journey operational browser suite completed on source commit6a71ad4 with exit0. Later backup transport/coverage changes have separate linked evidence and are not presented as part of that earlier full UI baseline.
