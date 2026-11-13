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

-- Additional explicit-version grant bundles; no current-user grant changes.
-- REVIEW ONLY: not a numbered migration, not in any deployment catalog.
-- Uses the owner/scope definitions above. The four template tables start empty.
CREATE TABLE ab.permission_template_versions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('role','department')),target_id text NOT NULL,version integer NOT NULL CHECK(version>0),definition_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,kind,target_id,version),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.permission_template_applications(id bigserial PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,version_id uuid NOT NULL REFERENCES ab.permission_template_versions(id),created_by uuid NOT NULL,detached boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.permission_template_links(application_id bigint NOT NULL REFERENCES ab.permission_template_applications(id),grant_id uuid NOT NULL REFERENCES ab.permission_grants(id) DEFERRABLE INITIALLY DEFERRED,tenant_id uuid NOT NULL,managed boolean NOT NULL,PRIMARY KEY(application_id,grant_id));
CREATE TABLE ab.permission_template_exceptions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,grant_id uuid NOT NULL REFERENCES ab.permission_grants(id),reason_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id));
CREATE INDEX permission_template_current_user ON ab.permission_template_applications(tenant_id,user_id,id DESC);
CREATE FUNCTION ab.permission_template_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'AB-PERMISSION-TEMPLATES-REVIEW-1'::text$$;
CREATE FUNCTION ab.permission_template_current_grants(person uuid)RETURNS TABLE(grant_id uuid,version_id uuid,kind text,target_id text,managed boolean)LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$BEGIN
 IF NOT ab.access_owner() THEN RAISE EXCEPTION 'owner only' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT l.grant_id,v.id,v.kind,v.target_id,l.managed FROM ab.permission_template_links l JOIN ab.permission_template_applications a ON a.id=l.application_id JOIN ab.permission_template_versions v ON v.id=a.version_id JOIN ab.permission_grants g ON g.id=l.grant_id WHERE a.tenant_id=ab.tenant()AND a.user_id=person AND v.tenant_id=a.tenant_id AND l.tenant_id=a.tenant_id AND g.tenant_id=a.tenant_id AND g.user_id=a.user_id AND g.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM ab.permission_template_applications newer JOIN ab.permission_template_versions nv ON nv.id=newer.version_id WHERE newer.tenant_id=a.tenant_id AND newer.user_id=a.user_id AND nv.kind=v.kind AND nv.target_id=v.target_id AND newer.id>a.id)AND NOT EXISTS(SELECT 1 FROM ab.permission_template_exceptions e WHERE e.tenant_id=a.tenant_id AND e.user_id=a.user_id AND e.grant_id=l.grant_id)ORDER BY l.grant_id,v.id;
END$$;
CREATE FUNCTION ab.permission_template_validate_row()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE a ab.permission_template_applications;v ab.permission_template_versions;g ab.permission_grants;BEGIN
 IF TG_TABLE_NAME='permission_template_links' THEN
 SELECT * INTO a FROM ab.permission_template_applications WHERE id=NEW.application_id;SELECT * INTO g FROM ab.permission_grants WHERE id=NEW.grant_id;
 IF a.tenant_id IS DISTINCT FROM NEW.tenant_id OR g.tenant_id IS DISTINCT FROM NEW.tenant_id OR g.user_id IS DISTINCT FROM a.user_id THEN RAISE EXCEPTION 'template grant scope' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='permission_template_applications' THEN
 SELECT * INTO v FROM ab.permission_template_versions WHERE id=NEW.version_id;
 IF v.tenant_id IS DISTINCT FROM NEW.tenant_id OR EXISTS(SELECT 1 FROM ab.users u WHERE u.id=NEW.user_id AND(u.role_id='owner'OR u.id=NEW.created_by))OR NOT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=NEW.created_by AND u.tenant_id=NEW.tenant_id AND u.role_id='owner'AND u.status='Active')OR NOT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=NEW.user_id AND u.tenant_id=NEW.tenant_id AND(u.status='Active'OR NEW.detached)AND((v.kind='role'AND u.role_id=v.target_id)OR(v.kind='department'AND EXISTS(SELECT 1 FROM ab.user_departments d WHERE d.user_id=u.id AND d.department_id::text=v.target_id AND d.active))))THEN RAISE EXCEPTION 'template target' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='permission_template_exceptions' THEN
 SELECT * INTO g FROM ab.permission_grants WHERE id=NEW.grant_id;
 IF g.tenant_id IS DISTINCT FROM NEW.tenant_id OR g.user_id IS DISTINCT FROM NEW.user_id OR NOT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=NEW.created_by AND u.tenant_id=NEW.tenant_id AND u.role_id='owner'AND u.status='Active')OR EXISTS(SELECT 1 FROM ab.users u WHERE u.id=NEW.user_id AND(u.role_id='owner'OR u.id=NEW.created_by))THEN RAISE EXCEPTION 'template exception' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;END$$;
CREATE CONSTRAINT TRIGGER validate_template_link AFTER INSERT ON ab.permission_template_links DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.permission_template_validate_row();
CREATE TRIGGER validate_template_application BEFORE INSERT ON ab.permission_template_applications FOR EACH ROW EXECUTE FUNCTION ab.permission_template_validate_row();
CREATE TRIGGER validate_template_exception BEFORE INSERT ON ab.permission_template_exceptions FOR EACH ROW EXECUTE FUNCTION ab.permission_template_validate_row();
CREATE FUNCTION ab.permission_template_revoke_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$BEGIN
 IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND EXISTS(SELECT 1 FROM ab.permission_template_links l JOIN ab.permission_template_applications a ON a.id=l.application_id JOIN ab.permission_template_versions v ON v.id=a.version_id WHERE l.grant_id=OLD.id AND a.tenant_id=OLD.tenant_id AND NOT EXISTS(SELECT 1 FROM ab.permission_template_applications newer JOIN ab.permission_template_versions nv ON nv.id=newer.version_id WHERE newer.user_id=a.user_id AND newer.tenant_id=a.tenant_id AND nv.kind=v.kind AND nv.target_id=v.target_id AND newer.id>a.id)AND NOT EXISTS(SELECT 1 FROM ab.permission_template_exceptions e WHERE e.tenant_id=a.tenant_id AND e.user_id=a.user_id AND e.grant_id=OLD.id))THEN RAISE EXCEPTION 'inherited grant requires template change or documented exception' USING ERRCODE='42501';END IF;RETURN NEW;END$$;
CREATE TRIGGER protected_template_grant BEFORE UPDATE ON ab.permission_grants FOR EACH ROW EXECUTE FUNCTION ab.permission_template_revoke_guard();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['permission_template_versions','permission_template_applications','permission_template_links','permission_template_exceptions']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_read ON ab.%I FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.access_owner())',t);
 EXECUTE format('CREATE POLICY owner_insert ON ab.%I FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.access_owner())',t);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',t);
 EXECUTE format('CREATE TRIGGER immutable_template_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',t);
 END LOOP;END$$;
GRANT USAGE ON SEQUENCE ab.permission_template_applications_id_seq TO ab_runtime;
REVOKE ALL ON FUNCTION ab.permission_template_current_grants(uuid),ab.permission_template_validate_row(),ab.permission_template_revoke_guard()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.permission_template_schema_version(),ab.permission_template_current_grants(uuid)TO ab_runtime;
-- A role/unit reassignment must not silently retain a managed grant from the old context.
-- Deferred checks allow the existing membership save to deactivate/reactivate unchanged rows.
CREATE FUNCTION ab.permission_template_context_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE person uuid;BEGIN
 IF TG_TABLE_NAME='users' THEN person=OLD.id;ELSE person=OLD.user_id;END IF;
 IF EXISTS(SELECT 1 FROM ab.permission_template_applications a JOIN ab.permission_template_versions v ON v.id=a.version_id JOIN ab.permission_template_links l ON l.application_id=a.id JOIN ab.permission_grants g ON g.id=l.grant_id JOIN ab.users u ON u.id=a.user_id WHERE a.user_id=person AND a.tenant_id=ab.tenant()AND g.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM ab.permission_template_exceptions e WHERE e.grant_id=g.id AND e.tenant_id=a.tenant_id)AND NOT EXISTS(SELECT 1 FROM ab.permission_template_applications newer JOIN ab.permission_template_versions nv ON nv.id=newer.version_id WHERE newer.tenant_id=a.tenant_id AND newer.user_id=a.user_id AND nv.kind=v.kind AND nv.target_id=v.target_id AND newer.id>a.id)AND((v.kind='role'AND v.target_id<>u.role_id)OR(v.kind='department'AND NOT EXISTS(SELECT 1 FROM ab.user_departments d WHERE d.user_id=u.id AND d.department_id::text=v.target_id AND d.active))))THEN RAISE EXCEPTION 'detach inherited template before changing role or unit' USING ERRCODE='42501';END IF;RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER permission_template_role_context AFTER UPDATE ON ab.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.permission_template_context_guard();
CREATE CONSTRAINT TRIGGER permission_template_unit_context AFTER UPDATE OR DELETE ON ab.user_departments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.permission_template_context_guard();
REVOKE ALL ON FUNCTION ab.permission_template_context_guard()FROM PUBLIC;
