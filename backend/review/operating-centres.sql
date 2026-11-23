-- REVIEW CANDIDATE ONLY. Not in migration manifests; never installed by web runtime.
-- Physical operating centres are distinct from geographic areas and financial cost centres.
-- No company memberships, permissions, historical financial records or balances are changed.
BEGIN;
SET LOCAL search_path=pg_catalog,ab;
CREATE FUNCTION ab.operating_centre_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users WHERE tenant_id=ab.tenant()
 AND id=nullif(current_setting('ab.actor',true),'')::uuid
 AND role_id='owner' AND status='Active');
$$;
REVOKE ALL ON FUNCTION ab.operating_centre_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.operating_centre_owner() TO ab_runtime;
CREATE TABLE ab.operating_centre_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,
 centre_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 previous_id uuid,effective_on date NOT NULL,
 emirate_id text NOT NULL REFERENCES ab.emirates,area_id text,
 state text NOT NULL CHECK(state IN('Active','Inactive')),
 payload_cipher text NOT NULL CHECK(length(payload_cipher)>0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,centre_id,revision),
 CHECK((revision=1 AND previous_id IS NULL)OR(revision>1 AND previous_id IS NOT NULL)),
 FOREIGN KEY(tenant_id,previous_id)REFERENCES ab.operating_centre_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,emirate_id,area_id)REFERENCES ab.areas(tenant_id,emirate_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE INDEX operating_centres_current ON ab.operating_centre_versions(tenant_id,centre_id,effective_on DESC,revision DESC);
CREATE TABLE ab.operating_centre_companies(
 tenant_id uuid NOT NULL,version_id uuid NOT NULL,company_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,version_id,company_id),
 FOREIGN KEY(tenant_id,version_id)REFERENCES ab.operating_centre_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id)
);
CREATE INDEX operating_centre_company_lookup ON ab.operating_centre_companies(tenant_id,company_id,version_id);
CREATE FUNCTION ab.operating_centre_version_guard()RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
DECLARE prior ab.operating_centre_versions;
BEGIN
 IF NOT ab.operating_centre_owner()THEN RAISE EXCEPTION 'operating centre Owner required' USING ERRCODE='42501';END IF;
 IF NEW.created_xid<>pg_current_xact_id() OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN
  RAISE EXCEPTION 'operating centre source actor mismatch' USING ERRCODE='23514';
 END IF;
 NEW.created_at:=transaction_timestamp();
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':operating-centre:'||NEW.centre_id::text,0));
 SELECT * INTO prior FROM ab.operating_centre_versions WHERE tenant_id=NEW.tenant_id AND centre_id=NEW.centre_id ORDER BY revision DESC LIMIT 1;
 IF FOUND THEN
  IF NEW.previous_id IS DISTINCT FROM prior.id OR NEW.revision<>prior.revision+1 THEN
   RAISE EXCEPTION 'operating centre source revision mismatch' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.revision<>1 OR NEW.previous_id IS NOT NULL THEN
  RAISE EXCEPTION 'operating centre initial version required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operating_centre_version_guard BEFORE INSERT ON ab.operating_centre_versions FOR EACH ROW EXECUTE FUNCTION ab.operating_centre_version_guard();
CREATE FUNCTION ab.operating_centre_link_guard()RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
BEGIN
 IF NOT ab.operating_centre_owner()THEN RAISE EXCEPTION 'operating centre Owner required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.operating_centre_versions WHERE tenant_id=NEW.tenant_id AND id=NEW.version_id AND created_xid=pg_current_xact_id()AND created_at=transaction_timestamp())THEN
  RAISE EXCEPTION 'operating centre snapshot is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operating_centre_link_guard BEFORE INSERT ON ab.operating_centre_companies FOR EACH ROW EXECUTE FUNCTION ab.operating_centre_link_guard();
REVOKE ALL ON FUNCTION ab.operating_centre_version_guard(),ab.operating_centre_link_guard() FROM PUBLIC;
ALTER TABLE ab.operating_centre_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.operating_centre_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE ab.operating_centre_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.operating_centre_companies FORCE ROW LEVEL SECURITY;
CREATE POLICY operating_centre_owner_read ON ab.operating_centre_versions FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY operating_centre_owner_insert ON ab.operating_centre_versions FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY operating_centre_link_owner_read ON ab.operating_centre_companies FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY operating_centre_link_owner_insert ON ab.operating_centre_companies FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.operating_centre_owner());
REVOKE ALL ON ab.operating_centre_versions,ab.operating_centre_companies FROM PUBLIC,ab_runtime;
GRANT SELECT,INSERT ON ab.operating_centre_versions,ab.operating_centre_companies TO ab_runtime;
COMMIT;
