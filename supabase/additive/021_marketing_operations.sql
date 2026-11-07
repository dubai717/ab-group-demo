CREATE TABLE ab.marketing_driver_enrollments(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,employee_id uuid NOT NULL,
 active boolean NOT NULL,consent_version_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),FOREIGN KEY(tenant_id,consent_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE INDEX marketing_consent_history ON ab.marketing_driver_enrollments(tenant_id,company_id,employee_id,created_at DESC);
CREATE TABLE ab.marketing_services(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,contract_id uuid NOT NULL,
 invoice_id uuid NOT NULL,voucher_id uuid NOT NULL,source_key text NOT NULL,payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,company_id,source_key),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,id),FOREIGN KEY(tenant_id,voucher_id)REFERENCES ab.finance_vouchers(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['marketing_driver_enrollments','marketing_services']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',tab);EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
END LOOP;END$$;

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['marketing_driver_enrollments','marketing_services']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
