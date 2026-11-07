-- Additive: preserves migrations 001–013, all existing grants, financial records and triggers.
-- Rehearse only on a synthetic database until approved release checks complete.
CREATE TABLE ab.hr_eos_estimates (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ab.organizations,
 employee_id uuid NOT NULL, company_id uuid NOT NULL, as_of date NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('employee_created','employee_updated','private_updated','compensation_version','settlement')),
 source_key text NOT NULL, payload_cipher text NOT NULL, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,employee_id,source_key),
 FOREIGN KEY(tenant_id,employee_id) REFERENCES ab.hr_employees(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.hr_eos_estimates ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION ab.eos_history_access(employee uuid,company uuid,writing boolean DEFAULT false)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.tenant_id=ab.tenant()AND u.status='Active'AND(u.role_id='owner'OR(NOT writing AND EXISTS(SELECT 1 FROM ab.hr_employees e WHERE e.tenant_id=u.tenant_id AND e.id=employee AND e.user_id=u.id))OR EXISTS(SELECT 1 FROM ab.permission_grants g WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL AND g.permission_id=ANY(CASE WHEN writing THEN ARRAY['hr_create','hr_edit','hr_private','hr_salary_edit']ELSE ARRAY['hr_eos_view']END)AND(g.scope_type='group'OR(g.scope_type='company'AND g.company_id=company)))))
$$;
REVOKE ALL ON FUNCTION ab.eos_history_access(uuid,uuid,boolean)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.eos_history_access(uuid,uuid,boolean)TO ab_runtime;
CREATE POLICY eos_history_read ON ab.hr_eos_estimates FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.eos_history_access(employee_id,company_id,false));
CREATE POLICY eos_history_write ON ab.hr_eos_estimates FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.eos_history_access(employee_id,company_id,true));
GRANT SELECT,INSERT ON ab.hr_eos_estimates TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.hr_eos_estimates FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE INDEX eos_employee_history ON ab.hr_eos_estimates(tenant_id,employee_id,created_at DESC);

CREATE TABLE ab.collection_attempts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,
 company_id uuid NOT NULL,customer_id uuid NOT NULL,vehicle_id uuid,invoice_id uuid NOT NULL,
 task_id uuid NOT NULL,outcome text NOT NULL,next_at timestamptz,payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,invoice_id) REFERENCES ab.vehicle_invoices(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES ab.customers(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,vehicle_id) REFERENCES ab.vehicles(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,task_id) REFERENCES ab.tasks(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.collection_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.collection_attempts USING(tenant_id=ab.tenant()) WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.collection_attempts TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.collection_attempts FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE INDEX collection_task_attempts ON ab.collection_attempts(tenant_id,task_id,created_at DESC);

CREATE FUNCTION ab.collection_attempt_source_valid()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
DECLARE i ab.vehicle_invoices;t ab.tasks;BEGIN
 SELECT * INTO i FROM ab.vehicle_invoices WHERE id=NEW.invoice_id AND tenant_id=NEW.tenant_id;
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF i.company_id IS DISTINCT FROM NEW.company_id OR i.customer_id IS DISTINCT FROM NEW.customer_id OR i.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR t.source_type IS DISTINCT FROM 'collection_invoice'OR t.source_id IS DISTINCT FROM i.id OR t.company_id IS DISTINCT FROM i.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'collection attempt source mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER collection_attempt_source_valid BEFORE INSERT ON ab.collection_attempts FOR EACH ROW EXECUTE FUNCTION ab.collection_attempt_source_valid();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['hr_eos_estimates','collection_attempts']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
