-- Extend the original invoice/receipt engine with an explicit external legal party.
-- Existing individual records retain their original constraints and accounting triggers.
ALTER TABLE ab.vehicle_invoices ADD COLUMN contracting_company_id uuid,ALTER COLUMN customer_id DROP NOT NULL,
 ADD CONSTRAINT invoice_contracting_fk FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 ADD CONSTRAINT invoice_exact_party CHECK(num_nonnulls(customer_id,contracting_company_id)=1),
 ADD CONSTRAINT contracting_invoice_kind CHECK(contracting_company_id IS NULL OR(kind='financial'AND vehicle_id IS NULL));
ALTER TABLE ab.finance_receipt_batches ADD COLUMN contracting_company_id uuid,ALTER COLUMN customer_id DROP NOT NULL,
 ADD CONSTRAINT batch_contracting_fk FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 ADD CONSTRAINT batch_exact_party CHECK(num_nonnulls(customer_id,contracting_company_id)=1),
 ADD CONSTRAINT contracting_batch_vehicle CHECK(contracting_company_id IS NULL OR vehicle_id IS NULL);
ALTER TABLE ab.finance_receipts ADD COLUMN contracting_company_id uuid,
 ADD CONSTRAINT receipt_contracting_fk FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 ADD CONSTRAINT receipt_exact_party CHECK((item_id IS NULL AND contracting_company_id IS NULL)OR(item_id IS NOT NULL AND num_nonnulls(customer_id,contracting_company_id)=1)),
 ADD CONSTRAINT contracting_receipt_vehicle CHECK(contracting_company_id IS NULL OR vehicle_id IS NULL);
CREATE INDEX contracting_invoice_due ON ab.vehicle_invoices(tenant_id,contracting_company_id,currency,due_on)WHERE contracting_company_id IS NOT NULL;
CREATE INDEX contracting_receipt_history ON ab.finance_receipts(tenant_id,contracting_company_id,received_on)WHERE contracting_company_id IS NOT NULL;
CREATE FUNCTION ab.contracting_financial_identity_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.contracting_company_id IS DISTINCT FROM OLD.contracting_company_id THEN RAISE EXCEPTION 'immutable financial party' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER contracting_invoice_identity BEFORE UPDATE ON ab.vehicle_invoices FOR EACH ROW EXECUTE FUNCTION ab.contracting_financial_identity_guard();
CREATE TRIGGER contracting_receipt_identity BEFORE UPDATE ON ab.finance_receipts FOR EACH ROW EXECUTE FUNCTION ab.contracting_financial_identity_guard();
CREATE TRIGGER contracting_batch_identity BEFORE UPDATE ON ab.finance_receipt_batches FOR EACH ROW EXECUTE FUNCTION ab.contracting_financial_identity_guard();
CREATE FUNCTION ab.contracting_allocation_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE bill ab.vehicle_invoices;r ab.finance_receipts;op ab.finance_operations;BEGIN
 SELECT * INTO bill FROM ab.vehicle_invoices WHERE id=NEW.invoice_id AND tenant_id=NEW.tenant_id;
 IF NEW.receipt_id IS NOT NULL THEN SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.receipt_id AND tenant_id=NEW.tenant_id;
 IF r.contracting_company_id IS DISTINCT FROM bill.contracting_company_id THEN RAISE EXCEPTION 'receipt contracting party mismatch' USING ERRCODE='23514';END IF;
 ELSE SELECT * INTO op FROM ab.finance_operations WHERE id=NEW.operation_id AND tenant_id=NEW.tenant_id;
 IF nullif(op.integration_refs->>'contractingReference','')IS DISTINCT FROM bill.contracting_company_id::text THEN RAISE EXCEPTION 'operation contracting party mismatch' USING ERRCODE='23514';END IF;END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER contracting_allocation_valid AFTER INSERT OR UPDATE ON ab.vehicle_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.contracting_allocation_valid();
CREATE FUNCTION ab.contracting_credit_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE s ab.finance_receipts;r ab.finance_receipts;BEGIN
 SELECT * INTO s FROM ab.finance_receipts WHERE id=NEW.source_receipt_id AND tenant_id=NEW.tenant_id;SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.application_receipt_id AND tenant_id=NEW.tenant_id;
 IF s.contracting_company_id IS DISTINCT FROM r.contracting_company_id THEN RAISE EXCEPTION 'credit contracting party mismatch' USING ERRCODE='23514';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER contracting_credit_valid AFTER INSERT OR UPDATE ON ab.finance_credit_applications DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.contracting_credit_valid();
REVOKE ALL ON FUNCTION ab.contracting_financial_identity_guard(),ab.contracting_allocation_valid(),ab.contracting_credit_valid()FROM PUBLIC;
CREATE TABLE ab.marketing_contract_bills(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,contract_id uuid NOT NULL,contracting_company_id uuid NOT NULL,invoice_id uuid NOT NULL,source_key text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,company_id,source_key),UNIQUE(tenant_id,invoice_id),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.marketing_contract_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.marketing_contract_bills USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.marketing_contract_bills TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.marketing_contract_bills FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['marketing_contract_bills']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
