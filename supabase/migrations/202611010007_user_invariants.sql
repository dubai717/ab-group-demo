CREATE FUNCTION ab.protect_user_invariants() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
BEGIN
 IF current_user='ab_runtime' THEN
  IF TG_OP='INSERT' AND NEW.role_id='owner' THEN RAISE EXCEPTION 'owner provisioning requires administrator' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND NEW.role_id<>OLD.role_id THEN RAISE EXCEPTION 'role change requires reviewed procedure' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.role_id='owner' AND (NEW.role_id<>'owner' OR NEW.status<>'Active') THEN RAISE EXCEPTION 'owner protected' USING ERRCODE='23514';END IF;
 IF NEW.manager_id IS NOT NULL AND EXISTS(
  WITH RECURSIVE managers(id,manager_id) AS (
   SELECT id,manager_id FROM ab.users WHERE id=NEW.manager_id AND tenant_id=NEW.tenant_id
   UNION SELECT u.id,u.manager_id FROM ab.users u JOIN managers m ON u.id=m.manager_id WHERE u.tenant_id=NEW.tenant_id
  ) SELECT 1 FROM managers WHERE id=NEW.id
 ) THEN RAISE EXCEPTION 'reporting cycle' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.protect_user_invariants() FROM PUBLIC;
CREATE TRIGGER protect_user_invariants BEFORE INSERT OR UPDATE ON ab.users FOR EACH ROW EXECUTE FUNCTION ab.protect_user_invariants();
