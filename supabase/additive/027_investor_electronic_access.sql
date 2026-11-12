-- Preserve profile immutability, except an explicit one-time owner login association.
CREATE FUNCTION ab.investor_profile_link_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'investor profile retained' USING ERRCODE='22023';END IF;
 IF NOT ab.investor_registry_owner() OR OLD.user_id IS NOT NULL OR NEW.user_id IS NULL OR (to_jsonb(NEW)-'user_id')IS DISTINCT FROM(to_jsonb(OLD)-'user_id') OR NOT EXISTS(SELECT 1 FROM ab.users WHERE tenant_id=NEW.tenant_id AND id=NEW.user_id AND role_id='investor'AND status='Active') THEN RAISE EXCEPTION 'investor profile immutable except owner login association' USING ERRCODE='42501';END IF;
 RETURN NEW;
END$$;
DROP TRIGGER immutable_history ON ab.investor_profiles;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.investor_profiles FOR EACH ROW EXECUTE FUNCTION ab.investor_profile_link_guard();
-- Owner-confirmed link to an EXISTING active investor login only.
-- No login creation, role/permission redistribution, data backfill or financial changes.
CREATE FUNCTION ab.investor_link_login(profile uuid,login uuid)RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE prior uuid;
BEGIN
 IF NOT ab.investor_registry_owner() THEN RAISE EXCEPTION 'owner confirmation required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.users WHERE tenant_id=ab.tenant()AND id=login AND role_id='investor'AND status='Active')THEN RAISE EXCEPTION 'existing active investor required' USING ERRCODE='22023';END IF;
 SELECT user_id INTO prior FROM ab.investor_profiles WHERE tenant_id=ab.tenant()AND id=profile FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable' USING ERRCODE='22023';END IF;
 IF prior IS NOT NULL THEN
  IF prior=login THEN RETURN;END IF;
  RAISE EXCEPTION 'existing link cannot be replaced' USING ERRCODE='22023';
 END IF;
 UPDATE ab.investor_profiles SET user_id=login WHERE tenant_id=ab.tenant()AND id=profile AND user_id IS NULL;
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)VALUES(gen_random_uuid(),ab.tenant(),nullif(current_setting('ab.actor',true),'')::uuid,'existing_login_linked','investor_profile',profile::text,ARRAY['user_id','existing-login-only','no-permission-changes'],gen_random_uuid());
END$$;
REVOKE ALL ON FUNCTION ab.investor_link_login(uuid,uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_link_login(uuid,uuid)TO ab_runtime;
