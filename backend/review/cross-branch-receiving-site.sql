-- Review candidate. Uses the original dated location and centre without changing their policies.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;

DO $$BEGIN
 IF current_user<>'postgres' OR to_regclass('ab.user_work_location_versions') IS NULL
    OR to_regprocedure('ab.cross_branch_collection_source(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'reviewed receiving site prerequisites required' USING ERRCODE='42501'; END IF;
END$$;

CREATE FUNCTION ab.cross_branch_receiving_site(legal_company uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE
 org uuid:=ab.tenant();
 principal uuid:=nullif(current_setting('ab.actor',true),'')::uuid;
 principal_role text;
 as_of date:=timezone('Asia/Dubai',transaction_timestamp())::date;
 location_row ab.user_work_location_versions;
 centre_row ab.operating_centre_versions;
 header jsonb;
BEGIN
 SELECT role_id INTO principal_role FROM ab.users
 WHERE tenant_id=org AND id=principal AND status='Active';
 IF current_user<>'postgres' OR NOT FOUND OR principal_role='investor' OR NOT ab.hr_actor_allowed()
 THEN RAISE EXCEPTION 'actual active work actor required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.companies WHERE tenant_id=org AND id=legal_company)
    OR (principal_role<>'owner' AND NOT EXISTS(
      SELECT 1 FROM ab.permission_grants g
      JOIN ab.users issuer ON issuer.tenant_id=g.tenant_id AND issuer.id=g.issuer_id
      WHERE g.tenant_id=org AND g.user_id=principal AND g.permission_id='ledger_cross_branch_collect'
        AND g.revoked_at IS NULL AND g.scope_type='company' AND g.company_id=legal_company
        AND issuer.role_id='owner' AND issuer.status='Active'
    ))
 THEN RAISE EXCEPTION 'explicit original company collection grant required' USING ERRCODE='42501'; END IF;
 header:=jsonb_build_object('actorId',principal,'tenantId',org,'companyId',legal_company,
   'asOf',to_char(as_of,'YYYY-MM-DD'));
 IF principal_role<>'owner' AND EXISTS(
   SELECT 1 FROM ab.settings WHERE tenant_id=org AND key='user-denials-v1:'||principal::text
 ) THEN RETURN header||jsonb_build_object('reviewRequired','individual_denial_source_review'); END IF;

 SELECT * INTO location_row FROM ab.user_work_location_versions
 WHERE tenant_id=org AND user_id=principal AND effective_on<=as_of
 ORDER BY effective_on DESC,revision DESC LIMIT 1;
 IF NOT FOUND OR location_row.centre_id IS NULL
 THEN RETURN header||jsonb_build_object('reviewRequired','receiving_site_unassigned'); END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.operating_centre_versions
   WHERE tenant_id=org AND id=location_row.centre_source_id AND centre_id=location_row.centre_id)
 THEN RETURN header||jsonb_build_object('reviewRequired','receiving_site_source_mismatch'); END IF;

 SELECT * INTO centre_row FROM ab.operating_centre_versions
 WHERE tenant_id=org AND centre_id=location_row.centre_id AND effective_on<=as_of
 ORDER BY effective_on DESC,revision DESC LIMIT 1;
 IF NOT FOUND OR centre_row.state<>'Active'
 THEN RETURN header||jsonb_build_object('reviewRequired','receiving_site_unavailable'); END IF;
 RETURN header||jsonb_build_object('centreId',centre_row.centre_id,
   'centreSourceId',centre_row.id,'locationSourceId',location_row.id);
END$$;

REVOKE ALL ON FUNCTION ab.cross_branch_receiving_site(uuid) FROM PUBLIC;
DO $$DECLARE r text;BEGIN
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN('anon','authenticated') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION ab.cross_branch_receiving_site(uuid) FROM %I',r);
 END LOOP;
END$$;
GRANT EXECUTE ON FUNCTION ab.cross_branch_receiving_site(uuid) TO ab_runtime;
COMMIT;
