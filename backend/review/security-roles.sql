-- SECURITY REVIEW CANDIDATE ONLY. Not in any automatic migration manifest.
-- Requires explicit owner approval and protected backup/restore gates before staging application.
BEGIN;
ALTER TABLE ab.roles ADD COLUMN tenant_id uuid REFERENCES ab.organizations(id) ON DELETE RESTRICT;
ALTER TABLE ab.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_role_visibility ON ab.roles FOR SELECT USING(tenant_id IS NULL OR tenant_id=ab.tenant());
ALTER TABLE ab.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_role_permission_visibility ON ab.role_permissions FOR SELECT USING(EXISTS(SELECT 1 FROM ab.roles r WHERE r.id=role_id));
CREATE FUNCTION ab.guard_security_role_tenant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ab.roles r WHERE r.id=NEW.role_id AND(r.tenant_id IS NULL OR r.tenant_id=NEW.tenant_id)) THEN RAISE EXCEPTION 'roleTenantMismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.guard_security_role_tenant() FROM PUBLIC;
CREATE TRIGGER security_role_tenant_guard BEFORE INSERT OR UPDATE OF role_id,tenant_id ON ab.users FOR EACH ROW EXECUTE FUNCTION ab.guard_security_role_tenant();

CREATE FUNCTION ab.save_security_role(role_key text,document jsonb,expected_revision integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE org uuid:=ab.tenant();actor uuid:=nullif(current_setting('ab.actor',true),'')::uuid;old jsonb;next jsonb;permission text;
BEGIN
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM ab.users WHERE id=actor AND tenant_id=org AND role_id='owner' AND status='Active') THEN RAISE EXCEPTION 'ownerOnly' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||':security-roles',0));
 IF role_key NOT LIKE 'security:'||org::text||':%' OR document->>'id' IS DISTINCT FROM role_key OR jsonb_typeof(document->'permissions') IS DISTINCT FROM 'array' OR coalesce(length(document->>'nameAr'),0)=0 OR coalesce(length(document->>'nameEn'),0)=0 THEN RAISE EXCEPTION 'invalidRole' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM ab.roles WHERE id=role_key AND tenant_id IS DISTINCT FROM org) THEN RAISE EXCEPTION 'ownerProtected' USING ERRCODE='42501';END IF;
 SELECT data INTO old FROM ab.roles WHERE id=role_key AND tenant_id=org FOR UPDATE;
 IF coalesce((old->>'revision')::int,0)<>expected_revision THEN RAISE EXCEPTION 'revisionConflict' USING ERRCODE='40001';END IF;
 IF EXISTS(SELECT 1 FROM ab.roles r WHERE r.tenant_id=org AND r.id<>role_key AND(lower(normalize(btrim(r.data->>'nameAr'),NFKC))IN(lower(normalize(document->>'nameAr',NFKC)),lower(normalize(document->>'nameEn',NFKC))) OR lower(normalize(btrim(r.data->>'nameEn'),NFKC))IN(lower(normalize(document->>'nameAr',NFKC)),lower(normalize(document->>'nameEn',NFKC))))) THEN RAISE EXCEPTION 'duplicateRole' USING ERRCODE='23514';END IF;
 FOR permission IN SELECT jsonb_array_elements_text(document->'permissions') LOOP
  IF NOT EXISTS(SELECT 1 FROM ab.permissions WHERE id=permission) THEN RAISE EXCEPTION 'invalidPermission' USING ERRCODE='23514';END IF;
 END LOOP;
 next:=document||jsonb_build_object('revision',expected_revision+1,'name',document->>'nameEn');
 IF old IS NULL THEN INSERT INTO ab.roles(id,data,tenant_id)VALUES(role_key,next,org);ELSE UPDATE ab.roles SET data=next WHERE id=role_key AND tenant_id=org;END IF;
 DELETE FROM ab.role_permissions WHERE role_id=role_key;
 INSERT INTO ab.role_permissions(role_id,permission_id)SELECT role_key,p FROM(SELECT DISTINCT jsonb_array_elements_text(next->'permissions')p)x;
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,fields,request_id)VALUES(gen_random_uuid(),org,actor,'security_role_saved','role',ARRAY[role_key,'before:'||coalesce(old::text,'null'),'after:'||next::text],gen_random_uuid());
 RETURN role_key;
END $$;
CREATE FUNCTION ab.assign_security_role(person uuid,role_key text,expected_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE org uuid:=ab.tenant();actor uuid:=nullif(current_setting('ab.actor',true),'')::uuid;old ab.users%ROWTYPE;
BEGIN
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM ab.users WHERE id=actor AND tenant_id=org AND role_id='owner' AND status='Active') THEN RAISE EXCEPTION 'ownerOnly' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||':security-roles',0));
 SELECT * INTO old FROM ab.users WHERE id=person AND tenant_id=org FOR UPDATE;
 IF old.id IS NULL OR old.role_id='owner' OR person=actor OR role_key='owner' THEN RAISE EXCEPTION 'ownerProtected' USING ERRCODE='42501';END IF;
 IF old.revision<>expected_revision THEN RAISE EXCEPTION 'revisionConflict' USING ERRCODE='40001';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.roles WHERE id=role_key AND(tenant_id IS NULL OR tenant_id=org)) THEN RAISE EXCEPTION 'invalidRole' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM ab.permission_grants WHERE issuer_id=person AND user_id<>person AND tenant_id=org AND revoked_at IS NULL) THEN RAISE EXCEPTION 'reviewDownstreamGrantsFirst' USING ERRCODE='23514';END IF;
 UPDATE ab.users SET role_id=role_key,revision=revision+1,updated_at=now()WHERE id=person AND tenant_id=org;
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)VALUES(gen_random_uuid(),org,actor,'security_role_assigned','user',person,ARRAY['before:'||old.role_id,'after:'||role_key,'company_and_department_scopes_unchanged','individual_grants_unchanged'],gen_random_uuid());
END $$;
REVOKE ALL ON FUNCTION ab.save_security_role(text,jsonb,integer),ab.assign_security_role(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.save_security_role(text,jsonb,integer),ab.assign_security_role(uuid,text,integer) TO ab_runtime;
COMMIT;
