-- REVIEW ONLY. Not in the active migration catalog; never run by an application deploy.
-- This proposal creates opt-in controls and no existing-user/role/grant mutations.
CREATE TABLE ab.user_access_bounds(user_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_ids uuid[],license_ids uuid[],emirate_ids text[],revision integer NOT NULL DEFAULT 1,updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,updated_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.user_access_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,actor_id uuid NOT NULL,before_state jsonb NOT NULL,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id));
CREATE FUNCTION ab.access_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$SELECT EXISTS(SELECT 1 FROM ab.users WHERE id=nullif(current_setting('ab.actor',true),'')::uuid AND tenant_id=ab.tenant() AND role_id='owner' AND status='Active')$$;
REVOKE ALL ON FUNCTION ab.access_owner() FROM PUBLIC;GRANT EXECUTE ON FUNCTION ab.access_owner() TO ab_runtime;
ALTER TABLE ab.user_access_bounds ENABLE ROW LEVEL SECURITY;ALTER TABLE ab.user_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON ab.user_access_bounds FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant() AND ab.access_owner());
CREATE POLICY owner_read ON ab.user_access_events FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant() AND ab.access_owner());
GRANT SELECT ON ab.user_access_bounds,ab.user_access_events TO ab_runtime;
CREATE TRIGGER immutable_access_history BEFORE UPDATE OR DELETE ON ab.user_access_events FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE FUNCTION ab.owner_company_scope(company uuid,license uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE bounds ab.user_access_bounds; co ab.companies; BEGIN
 SELECT * INTO bounds FROM ab.user_access_bounds WHERE user_id=nullif(current_setting('ab.actor',true),'')::uuid AND tenant_id=ab.tenant();
 IF NOT FOUND OR(bounds.company_ids IS NULL AND bounds.license_ids IS NULL AND bounds.emirate_ids IS NULL) THEN RETURN true;END IF;
 IF company IS NULL THEN RETURN false;END IF;
 SELECT * INTO co FROM ab.companies WHERE id=company AND tenant_id=ab.tenant();IF NOT FOUND THEN RETURN false;END IF;
 IF bounds.company_ids IS NOT NULL AND NOT(company=ANY(bounds.company_ids))THEN RETURN false;END IF;
 IF bounds.emirate_ids IS NOT NULL AND NOT(coalesce(co.emirate_id,'')=ANY(bounds.emirate_ids))THEN RETURN false;END IF;
 IF bounds.license_ids IS NOT NULL THEN
  IF license IS NOT NULL THEN RETURN license=ANY(bounds.license_ids) AND EXISTS(SELECT 1 FROM ab.company_licenses WHERE id=license AND company_id=company AND tenant_id=ab.tenant());END IF;
  RETURN EXISTS(SELECT 1 FROM ab.company_licenses WHERE company_id=company AND tenant_id=ab.tenant() AND id=ANY(bounds.license_ids));
 END IF;RETURN true;
END$$;
REVOKE ALL ON FUNCTION ab.owner_company_scope(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION ab.owner_company_scope(uuid,uuid) TO ab_runtime;
-- Scope is explicitly the company's registered emirate, not a vehicle location or GPS scope.
CREATE POLICY selected_access_bounds ON ab.companies AS RESTRICTIVE TO ab_runtime USING(ab.owner_company_scope(id)) WITH CHECK(ab.owner_company_scope(id));
DO $$DECLARE r record;lic text;BEGIN FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab' AND c.relkind='r' AND c.relname<>'permission_grants' AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='company_id' AND a.atttypid='uuid'::regtype AND NOT a.attisdropped) LOOP
 lic=CASE WHEN r.relname='company_licenses' THEN 'id' WHEN EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attname='license_id' AND a.atttypid='uuid'::regtype AND NOT a.attisdropped)THEN 'license_id' ELSE 'NULL::uuid' END;
 EXECUTE format('CREATE POLICY selected_access_bounds ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.owner_company_scope(company_id,%s)) WITH CHECK(ab.owner_company_scope(company_id,%s))',r.relname,lic,lic);
END LOOP;END$$;
CREATE FUNCTION ab.owner_apply_user_access(person uuid,next_role text,companies uuid[],licenses uuid[],emirates text[],expected_revision integer,confirmed boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE u ab.users; prior ab.user_access_bounds; actor uuid=nullif(current_setting('ab.actor',true),'')::uuid;next_revision integer; BEGIN
 IF NOT ab.access_owner() OR confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'owner confirmation required' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM ab.users WHERE id=person AND tenant_id=ab.tenant() FOR UPDATE;
 IF NOT FOUND OR person=actor OR u.role_id='owner' OR next_role='owner' THEN RAISE EXCEPTION 'protected target' USING ERRCODE='42501';END IF;
 IF u.revision<>expected_revision THEN RAISE EXCEPTION 'revision conflict' USING ERRCODE='40001';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.roles WHERE id=next_role) THEN RAISE EXCEPTION 'invalid role' USING ERRCODE='23514';END IF;
 IF companies IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(companies) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM ab.companies WHERE id=x AND tenant_id=ab.tenant()))THEN RAISE EXCEPTION 'invalid company' USING ERRCODE='23514';END IF;
 IF licenses IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(licenses) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM ab.company_licenses WHERE id=x AND tenant_id=ab.tenant()))THEN RAISE EXCEPTION 'invalid license' USING ERRCODE='23514';END IF;
 IF emirates IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(emirates) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM ab.emirates WHERE id=x))THEN RAISE EXCEPTION 'invalid emirate' USING ERRCODE='23514';END IF;
 SELECT * INTO prior FROM ab.user_access_bounds WHERE user_id=person;
 UPDATE ab.users SET role_id=next_role,revision=revision+1,updated_at=now() WHERE id=person RETURNING revision INTO next_revision;
 INSERT INTO ab.user_access_bounds(user_id,tenant_id,company_ids,license_ids,emirate_ids,updated_by)VALUES(person,ab.tenant(),companies,licenses,emirates,actor)ON CONFLICT(user_id)DO UPDATE SET company_ids=excluded.company_ids,license_ids=excluded.license_ids,emirate_ids=excluded.emirate_ids,revision=ab.user_access_bounds.revision+1,updated_by=actor,updated_at=now();
 INSERT INTO ab.user_access_events(id,tenant_id,user_id,actor_id,before_state,after_state)VALUES(gen_random_uuid(),ab.tenant(),person,actor,jsonb_build_object('role',u.role_id,'bounds',to_jsonb(prior)),jsonb_build_object('role',next_role,'companies',companies,'licenses',licenses,'companyEmirates',emirates));
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)VALUES(gen_random_uuid(),ab.tenant(),actor,'owner_access_confirmed','user',person,ARRAY['roleId','companyScope','licenseScope','companyEmirateScope','from:'||u.role_id,'to:'||next_role],gen_random_uuid());RETURN next_revision;
END$$;
REVOKE ALL ON FUNCTION ab.owner_apply_user_access(uuid,text,uuid[],uuid[],text[],integer,boolean) FROM PUBLIC;GRANT EXECUTE ON FUNCTION ab.owner_apply_user_access(uuid,text,uuid[],uuid[],text[],integer,boolean) TO ab_runtime;
