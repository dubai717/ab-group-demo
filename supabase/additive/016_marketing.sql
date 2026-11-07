-- Opt-in marketing records only. Existing roles, grants, official companies and finance remain authoritative.
CREATE TABLE ab.marketing_prospects(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,
 name_key text NOT NULL,official_company_id uuid,payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),UNIQUE(tenant_id,company_id,name_key),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,official_company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.marketing_opportunities(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,prospect_id uuid NOT NULL,
 stage text NOT NULL CHECK(stage IN('new','contacted','qualified','proposal','negotiation','contracted','lost')),
 assigned_user_id uuid NOT NULL,payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,prospect_id)REFERENCES ab.marketing_prospects(tenant_id,company_id,id),FOREIGN KEY(tenant_id,assigned_user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.marketing_contracts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,prospect_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('customer','insurance','tyres','maintenance','other_supplier')),
 state text NOT NULL CHECK(state IN('Draft','Active','Terminated','Expired')),starts_on date NOT NULL,ends_on date NOT NULL,
 payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on),UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,prospect_id)REFERENCES ab.marketing_prospects(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.marketing_allocations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,contract_id uuid NOT NULL,
 employee_id uuid,vehicle_id uuid,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'Active'CHECK(state IN('Active','Cancelled')),payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(num_nonnulls(employee_id,vehicle_id)=1),CHECK(ends_at>starts_at),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),FOREIGN KEY(tenant_id,company_id,vehicle_id)REFERENCES ab.vehicles(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE INDEX marketing_availability ON ab.marketing_allocations(tenant_id,company_id,starts_at,ends_at)WHERE state='Active';
CREATE TABLE ab.marketing_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,entity_id uuid NOT NULL,kind text NOT NULL,payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.marketing_targets(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,user_id uuid,department_id uuid,year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 metric text NOT NULL CHECK(metric IN('opportunities','contracts','contract_value')),payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,department_id)REFERENCES ab.departments(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['marketing_prospects','marketing_opportunities','marketing_contracts','marketing_allocations','marketing_events','marketing_targets']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 IF tab IN('marketing_events','marketing_targets')THEN EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
 ELSE EXECUTE format('GRANT UPDATE ON ab.%I TO ab_runtime',tab);END IF;
 END LOOP;END$$;
-- Resource overlap is checked under a per-resource advisory lock in the backend transaction.
-- No new role/permission assignments or changes to legacy grants are made here.

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['marketing_prospects','marketing_opportunities','marketing_contracts','marketing_allocations','marketing_events','marketing_targets']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
