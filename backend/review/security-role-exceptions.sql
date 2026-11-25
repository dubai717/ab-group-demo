-- SECURITY REVIEW CANDIDATE ONLY. Never part of automatic migration manifests.
-- Requires the reviewed security-roles.sql; apply only after Owner's final approval.
BEGIN;
CREATE FUNCTION ab.save_security_role_with_exceptions(role_key text,document jsonb,expected_revision integer,selected_grants uuid[]) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE org uuid:=ab.tenant();actor uuid:=nullif(current_setting('ab.actor',true),'')::uuid;before_grants jsonb;changed integer;answer text;
BEGIN
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM ab.users WHERE id=actor AND tenant_id=org AND role_id='owner' AND status='Active') THEN RAISE EXCEPTION 'ownerOnly' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||':security-roles',0));
 IF selected_grants IS NULL OR cardinality(selected_grants)<1 OR cardinality(selected_grants)>500 OR cardinality(selected_grants)<>(SELECT count(DISTINCT x)FROM unnest(selected_grants)x) THEN RAISE EXCEPTION 'invalidExceptionSelection' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.roles WHERE id=role_key AND tenant_id=org AND data->>'securityManaged'='true') THEN RAISE EXCEPTION 'builtInRoleProtected' USING ERRCODE='42501';END IF;
 -- Stable locks on affected accounts and precisely selected rows, never a tenant-wide grant rewrite.
 PERFORM u.id FROM ab.users u WHERE u.tenant_id=org AND u.role_id=role_key ORDER BY u.id FOR UPDATE;
 PERFORM g.id FROM ab.permission_grants g WHERE g.tenant_id=org AND g.id=ANY(selected_grants) ORDER BY g.id FOR UPDATE;
 SELECT jsonb_agg(to_jsonb(g)ORDER BY g.id) INTO before_grants FROM ab.permission_grants g JOIN ab.users u ON u.id=g.user_id AND u.tenant_id=g.tenant_id
 WHERE g.tenant_id=org AND g.id=ANY(selected_grants) AND g.revoked_at IS NULL AND u.role_id=role_key AND u.role_id<>'owner' AND u.id<>actor;
 IF coalesce(jsonb_array_length(before_grants),0)<>cardinality(selected_grants) THEN RAISE EXCEPTION 'exceptionOutsideStandard' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM ab.permission_grants child JOIN ab.permission_grants chosen ON chosen.user_id=child.issuer_id
 WHERE chosen.id=ANY(selected_grants) AND chosen.tenant_id=org AND child.tenant_id=org AND child.revoked_at IS NULL AND child.user_id<>child.issuer_id) THEN RAISE EXCEPTION 'reviewDownstreamGrantsFirst' USING ERRCODE='23514';END IF;
 answer:=ab.save_security_role(role_key,document,expected_revision);
 UPDATE ab.permission_grants SET revoked_at=now() WHERE tenant_id=org AND id=ANY(selected_grants) AND revoked_at IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>cardinality(selected_grants) THEN RAISE EXCEPTION 'permissionsChanged' USING ERRCODE='40001';END IF;
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,fields,request_id)
 VALUES(gen_random_uuid(),org,actor,'security_standard_exceptions_removed','role',ARRAY[role_key,'before:'||before_grants::text,'selected_ids:'||to_jsonb(selected_grants)::text,'after:revoked','unselected_grants_and_company_bank_overrides_unchanged'],gen_random_uuid());
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION ab.save_security_role_with_exceptions(text,jsonb,integer,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.save_security_role_with_exceptions(text,jsonb,integer,uuid[]) TO ab_runtime;
COMMIT;
