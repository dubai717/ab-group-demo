-- REVIEW CANDIDATE ONLY. Depends on reviewed operating-centres.sql; no runtime installation.
-- Existing user identity and primary physical work location only. No grants, scope or HR/payroll changes.
BEGIN;
SET LOCAL search_path=pg_catalog,ab;
CREATE TABLE ab.user_work_location_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,
 user_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),previous_id uuid,
 centre_id uuid,centre_source_id uuid,effective_on date NOT NULL,payload_cipher text NOT NULL CHECK(length(payload_cipher)>0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,revision),
 CHECK((revision=1 AND previous_id IS NULL)OR(revision>1 AND previous_id IS NOT NULL)),
 FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id),
 CHECK((centre_id IS NULL)=(centre_source_id IS NULL)),
 FOREIGN KEY(tenant_id,centre_source_id)REFERENCES ab.operating_centre_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,centre_id)REFERENCES ab.operating_centre_versions(tenant_id,root_centre_id),
 FOREIGN KEY(tenant_id,previous_id)REFERENCES ab.user_work_location_versions(tenant_id,id)
);
CREATE INDEX user_work_location_current ON ab.user_work_location_versions(tenant_id,user_id,effective_on DESC,revision DESC);
CREATE FUNCTION ab.user_work_location_guard()RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
DECLARE prior ab.user_work_location_versions;
BEGIN
 IF NOT ab.operating_centre_owner()THEN RAISE EXCEPTION 'work location Owner required' USING ERRCODE='42501';END IF;
 IF NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'work location actor mismatch' USING ERRCODE='23514';END IF;
 IF NEW.centre_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.operating_centre_versions WHERE tenant_id=NEW.tenant_id AND id=NEW.centre_source_id AND centre_id=NEW.centre_id)THEN RAISE EXCEPTION 'work location centre source mismatch' USING ERRCODE='23514';END IF;
 NEW.created_at:=transaction_timestamp();
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':user-work-location:'||NEW.user_id::text,0));
 SELECT * INTO prior FROM ab.user_work_location_versions WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id ORDER BY revision DESC LIMIT 1;
 IF FOUND THEN
  IF NEW.previous_id IS DISTINCT FROM prior.id OR NEW.revision<>prior.revision+1 THEN RAISE EXCEPTION 'work location source revision mismatch' USING ERRCODE='23514';END IF;
 ELSIF NEW.revision<>1 OR NEW.previous_id IS NOT NULL THEN RAISE EXCEPTION 'initial work location required' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.user_work_location_guard()FROM PUBLIC;
CREATE TRIGGER user_work_location_guard BEFORE INSERT ON ab.user_work_location_versions FOR EACH ROW EXECUTE FUNCTION ab.user_work_location_guard();
ALTER TABLE ab.user_work_location_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.user_work_location_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY user_work_location_owner_read ON ab.user_work_location_versions FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY user_work_location_owner_insert ON ab.user_work_location_versions FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.operating_centre_owner());
REVOKE ALL ON ab.user_work_location_versions FROM PUBLIC,ab_runtime;
GRANT SELECT,INSERT ON ab.user_work_location_versions TO ab_runtime;
COMMIT;
