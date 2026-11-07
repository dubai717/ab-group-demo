CREATE TABLE ab.saved_reports(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,owner_id uuid NOT NULL,title text NOT NULL,
 definition_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,owner_id)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.report_shares(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,report_id uuid NOT NULL,user_id uuid NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,report_id,user_id),
 FOREIGN KEY(tenant_id,report_id)REFERENCES ab.saved_reports(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.report_schedules(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,report_id uuid NOT NULL,owner_id uuid NOT NULL,
 next_at timestamptz NOT NULL,frequency text NOT NULL CHECK(frequency IN('once','daily','weekly','monthly')),
 state text NOT NULL DEFAULT 'Active'CHECK(state IN('Active','Paused','Completed')),payload_cipher text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,report_id)REFERENCES ab.saved_reports(tenant_id,id),FOREIGN KEY(tenant_id,owner_id)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.report_runs(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,schedule_id uuid NOT NULL,user_id uuid NOT NULL,due_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('available','access_denied')),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,schedule_id,user_id,due_at),FOREIGN KEY(tenant_id,schedule_id)REFERENCES ab.report_schedules(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['saved_reports','report_shares','report_schedules','report_runs']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 IF tab='report_schedules'THEN EXECUTE format('GRANT UPDATE ON ab.%I TO ab_runtime',tab);
 ELSE EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);END IF;
 END LOOP;END$$;
-- Narrow discovery only, matching the existing financial/personnel job-scope pattern.
CREATE FUNCTION ab.report_job_scopes()RETURNS TABLE(tenant_id uuid,actor_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT DISTINCT s.tenant_id,s.owner_id FROM ab.report_schedules s JOIN ab.users u ON u.id=s.owner_id AND u.tenant_id=s.tenant_id
 WHERE s.state='Active'AND s.next_at<=now()AND u.status='Active'
$$;
REVOKE ALL ON FUNCTION ab.report_job_scopes()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.report_job_scopes()TO ab_runtime;
