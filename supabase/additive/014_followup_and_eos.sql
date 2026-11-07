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
CREATE POLICY tenant_scope ON ab.hr_eos_estimates USING(tenant_id=ab.tenant()) WITH CHECK(tenant_id=ab.tenant());
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
