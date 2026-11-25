-- REVIEW ONLY: excluded from manifests. Technical ingress receipt, not a second conversation system.
BEGIN;
CREATE TABLE ab.communication_provider_envelopes(
 tenant_id uuid NOT NULL REFERENCES ab.organizations,envelope_hash text NOT NULL CHECK(envelope_hash~'^[a-f0-9]{64}$'),
 payload_cipher text NOT NULL,received_by uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,envelope_hash),FOREIGN KEY(tenant_id,received_by)REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.communication_provider_events(
 tenant_id uuid NOT NULL REFERENCES ab.organizations,id uuid NOT NULL,
 provider text NOT NULL CHECK(provider='meta_cloud'),event_key text NOT NULL CHECK(event_key~'^[a-f0-9]{64}$'),
 event_kind text NOT NULL CHECK(event_kind IN('message','status')),payload_hash text NOT NULL CHECK(payload_hash~'^[a-f0-9]{64}$'),
 envelope_hash text NOT NULL CHECK(envelope_hash~'^[a-f0-9]{64}$'),payload_cipher text NOT NULL,
 received_by uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,provider,event_key),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,received_by)REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,envelope_hash)REFERENCES ab.communication_provider_envelopes(tenant_id,envelope_hash)DEFERRABLE INITIALLY DEFERRED);
DO $$DECLARE tab text;role_name text;BEGIN
 FOREACH tab IN ARRAY ARRAY['communication_provider_events','communication_provider_envelopes']LOOP
  EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE ab.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format($policy$CREATE POLICY ingress_owner_scope ON ab.%1$I TO ab_runtime
   USING(tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.users u WHERE u.tenant_id=%1$I.tenant_id AND u.id=(SELECT nullif(pg_catalog.current_setting('ab.actor',true),'')::uuid)AND u.role_id='owner'AND u.status='Active'))
   WITH CHECK(tenant_id=(SELECT ab.tenant())AND received_by=(SELECT nullif(pg_catalog.current_setting('ab.actor',true),'')::uuid)AND EXISTS(SELECT 1 FROM ab.users u WHERE u.tenant_id=%1$I.tenant_id AND u.id=%1$I.received_by AND u.role_id='owner'AND u.status='Active'))$policy$,tab);
  EXECUTE format('CREATE POLICY ingress_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
  EXECUTE format('REVOKE ALL ON ab.%I FROM PUBLIC',tab);
  FOR role_name IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated')LOOP EXECUTE format('REVOKE ALL ON ab.%I FROM %I',tab,role_name);END LOOP;
  EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
  EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
 END LOOP;
END$$;
-- No anonymous webhook DB role, sender assignment, customer match, delivery claim or financial write.
COMMIT;
