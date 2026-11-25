# Hosted technical-owner compatibility — read-only evidence,24Nov2026

Target verified by the connected Supabase project metadata as `ab-group-erp-test` (`gwcujfbckejzacdoobua`), PostgreSQL17.11, ACTIVE_HEALTHY. Three small catalog SELECTs were executed. No customer, document, balance, contract, encrypted payload, credential or Auth row was selected. No schema, permission, reset/restore control, application setting or data was changed. No second project was queried.

Observed:

- Inspection role `postgres`: superuser=false, BYPASSRLS=true, already present before this review.
- `ab_runtime`: superuser=false, BYPASSRLS=false;0 memberships in superuser/BYPASSRLS roles;0 owned application tables.
-27 existing SECURITY DEFINER functions, all owned by the existing `postgres` technical role with BYPASSRLS.
-162 application tables;158 have RLS enabled. The four without RLS are the shared reference catalogs `emirates`, `permissions`, `role_permissions`, `roles`. They have runtime SELECT and no anon/authenticated SELECT; this count is not evidence of four unprotected customer tables.
- Proposed `ab.current_company_scope_ids()` is absent, as expected: the review prototypes have not been installed.

The observed role model matches the conservative installation prerequisites of the isolated company-bound candidates. There is no reason here to grant BYPASSRLS or change function/table ownership. This resolves the earlier unknown about the technical-owner role, not the complete source/privilege/API compatibility review. No candidate source pin was changed or made applicable based on these facts. Remaining company membership, nullable/shared/private/self-service/cross-branch source policies, exact deployed schema and compiled-readiness/rollback acceptance are still required before a final protected release.

A successful catalog read proves connectivity for these bounded reads; it does not prove end-user login, a financial save, Storage recovery, deployment, complete RLS authorization or the independent backup inventory. No live action was tested.
