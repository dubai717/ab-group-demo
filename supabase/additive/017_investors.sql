-- Investor tracking references existing Auth users, financing requests, actual bank operations and vouchers.
-- No parallel cash journal, no existing roles/grants changed.
CREATE TABLE ab.investor_profiles(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,user_id uuid NOT NULL,
 payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_agreements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,investor_id uuid NOT NULL,
 mode text NOT NULL CHECK(mode IN('prefunded','committed')),currency char(3)NOT NULL,state text NOT NULL DEFAULT 'Active'CHECK(state IN('Active','Inactive','Terminated')),
 payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_funding_requests(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,agreement_id uuid NOT NULL,request_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'Requested'CHECK(state IN('Requested','Accepted','Declined','Funded')),amount numeric(21,3)NOT NULL CHECK(amount>0),
 terms_cipher text NOT NULL,response_cipher text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,request_id),FOREIGN KEY(tenant_id,company_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,company_id,id),FOREIGN KEY(tenant_id,request_id)REFERENCES ab.vehicle_requests(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_capital_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,agreement_id uuid NOT NULL,operation_id uuid NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,operation_id),
 FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,operation_id)REFERENCES ab.finance_operations(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_payouts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,agreement_id uuid NOT NULL,voucher_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('capital_refund','returns_payout')),source_capital_operation_id uuid,month date,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='capital_refund')=(source_capital_operation_id IS NOT NULL)),UNIQUE(tenant_id,id),UNIQUE(tenant_id,voucher_id),FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,source_capital_operation_id)REFERENCES ab.finance_operations(tenant_id,id),FOREIGN KEY(tenant_id,voucher_id)REFERENCES ab.finance_vouchers(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,investor_id uuid NOT NULL,agreement_id uuid,kind text NOT NULL,
 payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['investor_profiles','investor_agreements','investor_funding_requests','investor_capital_links','investor_payouts','investor_events']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 IF tab IN('investor_agreements','investor_funding_requests')THEN EXECUTE format('GRANT UPDATE ON ab.%I TO ab_runtime',tab);
 ELSE EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);END IF;
 END LOOP;END$$;
