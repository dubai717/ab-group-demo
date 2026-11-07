-- Internal communication reuses finance_notifications; external providers are intentionally inactive.
CREATE TABLE ab.communication_threads(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,
 source_type text NOT NULL CHECK(source_type IN('company','customer','vehicle','invoice','task','marketing','investment')),source_id uuid NOT NULL,
 subject_cipher text NOT NULL,template_digest text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX communication_template_once ON ab.communication_threads(tenant_id,created_by,template_digest);
CREATE TABLE ab.communication_participants(
 tenant_id uuid NOT NULL,thread_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(tenant_id,thread_id,user_id),
 FOREIGN KEY(tenant_id,thread_id)REFERENCES ab.communication_threads(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.communication_messages(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,thread_id uuid NOT NULL,sender_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel='internal'),body_cipher text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,thread_id)REFERENCES ab.communication_threads(tenant_id,id),FOREIGN KEY(tenant_id,sender_id)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.communication_templates(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,template_key text NOT NULL,locale text NOT NULL,
 version integer NOT NULL CHECK(version>0),payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,template_key,locale,version),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.notification_receipts(
 tenant_id uuid NOT NULL,notification_id uuid NOT NULL,user_id uuid NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,notification_id,user_id),FOREIGN KEY(tenant_id,notification_id)REFERENCES ab.finance_notifications(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['communication_threads','communication_participants','communication_messages','communication_templates','notification_receipts']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
 END LOOP;END$$;
CREATE FUNCTION ab.communication_source_valid()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
DECLARE tab text;co uuid;BEGIN
 tab=CASE NEW.source_type WHEN 'company'THEN 'companies' WHEN 'customer'THEN 'customers' WHEN 'vehicle'THEN 'vehicles' WHEN 'invoice'THEN 'vehicle_invoices' WHEN 'task'THEN 'tasks' WHEN 'marketing'THEN 'marketing_opportunities' WHEN 'investment'THEN 'investor_agreements' END;
 IF tab='companies'THEN SELECT id INTO co FROM ab.companies WHERE id=NEW.source_id AND tenant_id=NEW.tenant_id;
 ELSE EXECUTE format('SELECT company_id FROM ab.%I WHERE id=$1 AND tenant_id=$2',tab)INTO co USING NEW.source_id,NEW.tenant_id;END IF;
 IF co IS NULL OR co IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'communication source mismatch' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
CREATE TRIGGER source_validation BEFORE INSERT ON ab.communication_threads FOR EACH ROW EXECUTE FUNCTION ab.communication_source_valid();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['communication_threads','communication_participants','communication_messages','communication_templates','notification_receipts']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
