-- REVIEW ONLY: not an automatic migration or hosted installer.
-- Customer identity visibility is not permission to read every personal attachment.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.customer_identity_in_scope(uuid)')IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'reviewed identity/authentication owner required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND(rolsuper OR rolbypassrls))OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname IN('customer_files','customer_file_reviews')AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own attachment source' USING ERRCODE='42501';END IF;
END$$;
-- An internal scoped Boolean lookup is necessary for same-table lineage checks.
-- It returns no file metadata/object keys/bytes; caller cannot supply tenant, actor or scope.
-- Existing original tenant/session scope is mandatory; no privilege/membership is changed.
CREATE FUNCTION ab.customer_attachment_in_scope(target pg_catalog.uuid, expected_customer pg_catalog.uuid DEFAULT NULL, expected_company pg_catalog.uuid DEFAULT NULL)RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE org pg_catalog.uuid; allowed pg_catalog.uuid[];
BEGIN
 IF current_user<>'postgres'THEN RAISE EXCEPTION 'reviewed attachment reader owner required' USING ERRCODE='42501';END IF;
 org:=ab.tenant();allowed:=ab.current_company_scope_ids();
 RETURN EXISTS(SELECT 1 FROM ab.customer_files f WHERE f.tenant_id=org AND f.id=target
  AND(expected_customer IS NULL OR f.customer_id=expected_customer)
  AND(expected_company IS NULL OR f.company_id=expected_company)
  AND(allowed IS NULL OR f.company_id=ANY(allowed))
  AND ab.customer_identity_in_scope(f.customer_id));
END$$;
REVOKE ALL ON FUNCTION ab.customer_attachment_in_scope(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.customer_attachment_in_scope(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)TO ab_runtime;
ALTER TABLE ab.customer_files FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_customer_attachment_read ON ab.customer_files AS RESTRICTIVE FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.customer_attachment_in_scope(id));
CREATE POLICY reviewed_customer_attachment_insert ON ab.customer_files AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids()))AND ab.customer_identity_in_scope(customer_id)AND(parent_id IS NULL OR ab.customer_attachment_in_scope(parent_id,customer_id,company_id)));
-- The existing immutable-file trigger and original scanner-only review writes stay intact.
ALTER TABLE ab.customer_file_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_customer_attachment_review_read ON ab.customer_file_reviews AS RESTRICTIVE FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.customer_attachment_in_scope(file_id));
COMMIT;
