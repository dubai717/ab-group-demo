-- REVIEW ONLY. Excluded from automatic manifests. No financial row is modified.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'reviewed original technical owner required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND(rolsuper OR rolbypassrls))OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname='finance_statement_lines'AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own statement child source' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.finance_statement_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_statement_line_parent ON ab.finance_statement_lines AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR(
 EXISTS(SELECT 1 FROM ab.finance_statements st WHERE st.tenant_id=ab.tenant()AND st.id=statement_id)
 AND(entry_id IS NULL OR EXISTS(SELECT 1 FROM ab.finance_entries e WHERE e.tenant_id=ab.tenant()AND e.id=entry_id))
)))WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR(
 EXISTS(SELECT 1 FROM ab.finance_statements st WHERE st.tenant_id=ab.tenant()AND st.id=statement_id)
 AND(entry_id IS NULL OR EXISTS(SELECT 1 FROM ab.finance_entries e WHERE e.tenant_id=ab.tenant()AND e.id=entry_id))
)));
-- Original reconciliation amount/date/account rules remain in the existing controller.
-- Personal-owner/shared statement relationships require their own review before scope apply.
COMMIT;
