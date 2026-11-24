-- REVIEW ONLY. Not a manifest/runtime installer. Personal identity is not one company.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'reviewed identity/authentication owner required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND(rolsuper OR rolbypassrls))OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname IN('customers','customer_drafts','vehicle_requests','vehicles')AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own identity source' USING ERRCODE='42501';END IF;
END$$;
-- One narrow stable Boolean reader avoids recursive customer/request RLS expansion.
-- No caller tenant/actor/scope arguments, decryption, data return, write or context change.
CREATE FUNCTION ab.customer_identity_in_scope(customer pg_catalog.uuid)RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE allowed pg_catalog.uuid[]; org pg_catalog.uuid;
BEGIN
 IF current_user<>'postgres'THEN RAISE EXCEPTION 'reviewed identity reader owner required' USING ERRCODE='42501';END IF;
 org:=ab.tenant();allowed:=ab.current_company_scope_ids();
 RETURN EXISTS(SELECT 1 FROM ab.customers c WHERE c.tenant_id=org AND c.id=customer AND(
  allowed IS NULL OR c.company_id=ANY(allowed)
  OR EXISTS(SELECT 1 FROM ab.vehicle_requests r WHERE r.tenant_id=org AND r.customer_id=c.id AND r.company_id=ANY(allowed))
  OR EXISTS(SELECT 1 FROM ab.customer_events e WHERE e.tenant_id=org AND e.customer_id=c.id AND e.kind='service_request_created'AND e.company_id=ANY(allowed))
  OR EXISTS(SELECT 1 FROM ab.vehicles v WHERE v.tenant_id=org AND v.customer_id=c.id AND v.company_id=ANY(allowed))
 ));
END$$;
REVOKE ALL ON FUNCTION ab.customer_identity_in_scope(pg_catalog.uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.customer_identity_in_scope(pg_catalog.uuid)TO ab_runtime;
ALTER TABLE ab.customers FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_customer_identity_read ON ab.customers AS RESTRICTIVE FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.customer_identity_in_scope(id));
-- Cross-company visibility cannot transfer or edit the legacy owner-company record.
CREATE POLICY reviewed_customer_identity_insert ON ab.customers AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
CREATE POLICY reviewed_customer_identity_update ON ab.customers AS RESTRICTIVE FOR UPDATE TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())))WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
CREATE POLICY reviewed_customer_identity_delete ON ab.customers AS RESTRICTIVE FOR DELETE TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
-- A raw new request/vehicle must not manufacture a relationship to an invisible person.
CREATE POLICY reviewed_service_customer_reference ON ab.customer_events AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(ab.current_company_scope_ids()IS NULL OR ab.customer_identity_in_scope(customer_id));
CREATE POLICY reviewed_request_customer_reference ON ab.vehicle_requests AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(ab.current_company_scope_ids()IS NULL OR ab.customer_identity_in_scope(customer_id));
CREATE POLICY reviewed_request_customer_update ON ab.vehicle_requests AS RESTRICTIVE FOR UPDATE TO ab_runtime USING(true)WITH CHECK(ab.current_company_scope_ids()IS NULL OR ab.customer_identity_in_scope(customer_id));
CREATE POLICY reviewed_vehicle_customer_reference ON ab.vehicles AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(ab.current_company_scope_ids()IS NULL OR ab.customer_identity_in_scope(customer_id));
CREATE POLICY reviewed_vehicle_customer_update ON ab.vehicles AS RESTRICTIVE FOR UPDATE TO ab_runtime USING(true)WITH CHECK(ab.current_company_scope_ids()IS NULL OR ab.customer_identity_in_scope(customer_id));
ALTER TABLE ab.customer_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_customer_draft_owner ON ab.customer_drafts AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR(actor_id=nullif(pg_catalog.current_setting('ab.actor',true),'')::uuid AND company_id=ANY(ab.current_company_scope_ids()))))WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR(actor_id=nullif(pg_catalog.current_setting('ab.actor',true),'')::uuid AND company_id=ANY(ab.current_company_scope_ids())AND(final_customer_id IS NULL OR ab.customer_identity_in_scope(final_customer_id)))));
COMMIT;
