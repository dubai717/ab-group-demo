-- REVIEW ONLY. No automatic migration, new object store or document sharing grant.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.customer_attachment_in_scope(uuid,uuid,uuid)')IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'reviewed attachment source required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND(rolsuper OR rolbypassrls))OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname IN('document_text_index','document_archive_events','document_links')AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own document child source' USING ERRCODE='42501';END IF;
END$$;
-- Invoker lookup over distinct parent tables; never changes identity or bypasses RLS.
-- Shared/private nullable-company documents still require their separate relationship design.
CREATE FUNCTION ab.document_source_in_scope(version_id pg_catalog.uuid, customer_file pg_catalog.uuid, vehicle_file pg_catalog.uuid)RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab,pg_temp AS $$
 SELECT pg_catalog.num_nonnulls(version_id,customer_file,vehicle_file)=1 AND(
  (version_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.document_versions v JOIN ab.documents d ON d.tenant_id=v.tenant_id AND d.id=v.document_id WHERE v.tenant_id=ab.tenant()AND v.id=version_id AND(ab.current_company_scope_ids()IS NULL OR d.company_id=ANY(ab.current_company_scope_ids()))))
  OR(customer_file IS NOT NULL AND ab.customer_attachment_in_scope(customer_file))
  OR(vehicle_file IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicle_files f WHERE f.tenant_id=ab.tenant()AND f.id=vehicle_file AND(ab.current_company_scope_ids()IS NULL OR f.company_id=ANY(ab.current_company_scope_ids()))))
 )
$$;
REVOKE ALL ON FUNCTION ab.document_source_in_scope(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.document_source_in_scope(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)TO ab_runtime;
ALTER TABLE ab.document_text_index FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_document_text_source ON ab.document_text_index AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND ab.document_source_in_scope(version_id,customer_file_id,vehicle_file_id))WITH CHECK(tenant_id=ab.tenant()AND ab.document_source_in_scope(version_id,customer_file_id,vehicle_file_id));
ALTER TABLE ab.document_archive_events FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_document_archive_source ON ab.document_archive_events AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND(
 (document_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.documents d WHERE d.tenant_id=ab.tenant()AND d.id=document_id AND(ab.current_company_scope_ids()IS NULL OR d.company_id=ANY(ab.current_company_scope_ids()))))
 OR(customer_file_id IS NOT NULL AND ab.customer_attachment_in_scope(customer_file_id))
 OR(vehicle_file_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicle_files f WHERE f.tenant_id=ab.tenant()AND f.id=vehicle_file_id AND(ab.current_company_scope_ids()IS NULL OR f.company_id=ANY(ab.current_company_scope_ids()))))
))WITH CHECK(tenant_id=ab.tenant()AND(
 (document_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.documents d WHERE d.tenant_id=ab.tenant()AND d.id=document_id AND(ab.current_company_scope_ids()IS NULL OR d.company_id=ANY(ab.current_company_scope_ids()))))
 OR(customer_file_id IS NOT NULL AND ab.customer_attachment_in_scope(customer_file_id))
 OR(vehicle_file_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicle_files f WHERE f.tenant_id=ab.tenant()AND f.id=vehicle_file_id AND(ab.current_company_scope_ids()IS NULL OR f.company_id=ANY(ab.current_company_scope_ids()))))
));
ALTER TABLE ab.document_links FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_document_link_source ON ab.document_links AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND(
 (document_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.documents d WHERE d.tenant_id=ab.tenant()AND d.id=document_id AND(ab.current_company_scope_ids()IS NULL OR d.company_id=ANY(ab.current_company_scope_ids()))))
 OR(customer_file_id IS NOT NULL AND ab.customer_attachment_in_scope(customer_file_id))
 OR(vehicle_file_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicle_files f WHERE f.tenant_id=ab.tenant()AND f.id=vehicle_file_id AND(ab.current_company_scope_ids()IS NULL OR f.company_id=ANY(ab.current_company_scope_ids()))))
)AND(
 (company_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.companies co WHERE co.tenant_id=ab.tenant()AND co.id=company_id AND(ab.current_company_scope_ids()IS NULL OR co.id=ANY(ab.current_company_scope_ids()))))
 OR(customer_id IS NOT NULL AND ab.customer_identity_in_scope(customer_id))
 OR(vehicle_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicles v WHERE v.tenant_id=ab.tenant()AND v.id=vehicle_id))
))WITH CHECK(tenant_id=ab.tenant()AND(
 (document_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.documents d WHERE d.tenant_id=ab.tenant()AND d.id=document_id AND(ab.current_company_scope_ids()IS NULL OR d.company_id=ANY(ab.current_company_scope_ids()))))
 OR(customer_file_id IS NOT NULL AND ab.customer_attachment_in_scope(customer_file_id))
 OR(vehicle_file_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicle_files f WHERE f.tenant_id=ab.tenant()AND f.id=vehicle_file_id AND(ab.current_company_scope_ids()IS NULL OR f.company_id=ANY(ab.current_company_scope_ids()))))
)AND(
 (company_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.companies co WHERE co.tenant_id=ab.tenant()AND co.id=company_id AND(ab.current_company_scope_ids()IS NULL OR co.id=ANY(ab.current_company_scope_ids()))))
 OR(customer_id IS NOT NULL AND ab.customer_identity_in_scope(customer_id))
 OR(vehicle_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.vehicles v WHERE v.tenant_id=ab.tenant()AND v.id=vehicle_id))
));
COMMIT;
