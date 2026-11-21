-- REVIEW ONLY: isolated acceptance only; explicit schema approval required before activation.
-- Extends the exact previously reviewed manual-claim adapter, retaining legacy invoice behavior.
DO $check$BEGIN IF(SELECT prosrc FROM pg_proc WHERE oid='ab.collection_attempt_source_valid()'::regprocedure)IS DISTINCT FROM $original$DECLARE i ab.vehicle_invoices;t ab.tasks;BEGIN
 IF NEW.manual_claim_id IS NULL THEN
 SELECT * INTO i FROM ab.vehicle_invoices WHERE id=NEW.invoice_id AND tenant_id=NEW.tenant_id;
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF i.company_id IS DISTINCT FROM NEW.company_id OR i.customer_id IS DISTINCT FROM NEW.customer_id OR i.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR t.source_type IS DISTINCT FROM 'collection_invoice'OR t.source_id IS DISTINCT FROM i.id OR t.company_id IS DISTINCT FROM i.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'collection attempt source mismatch' USING ERRCODE='23514';END IF;RETURN NEW;

 ELSE
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF NEW.invoice_id IS NOT NULL OR NEW.customer_id IS NOT NULL OR NEW.vehicle_id IS NOT NULL OR t.id IS NULL OR t.source_type IS DISTINCT FROM 'collection_claim' OR t.source_id IS DISTINCT FROM NEW.manual_claim_id OR t.company_id IS DISTINCT FROM NEW.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid OR NOT EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=NEW.tenant_id AND key='manual-receivable-claim-v1:records:'||NEW.company_id::text||':'||NEW.manual_claim_id::text) OR NOT EXISTS(SELECT 1 FROM ab.finance_journals j WHERE j.company_id=NEW.company_id AND j.source_key='manual-claim:'||NEW.manual_claim_id::text AND j.status='Posted'AND NOT EXISTS(SELECT 1 FROM ab.finance_journals x WHERE x.reversal_of=j.id)) THEN RAISE EXCEPTION 'collection claim source mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
 END IF;
END$original$ THEN RAISE EXCEPTION 'unreviewed collection source guard' USING ERRCODE='23514';END IF;END$check$;
ALTER TABLE ab.collection_attempts ADD COLUMN employee_advance_id uuid,
 DROP CONSTRAINT collection_attempt_exact_source,
 ADD CONSTRAINT collection_attempt_exact_source CHECK(
 (employee_advance_id IS NULL AND manual_claim_id IS NULL AND invoice_id IS NOT NULL AND customer_id IS NOT NULL)
 OR(employee_advance_id IS NULL AND manual_claim_id IS NOT NULL AND invoice_id IS NULL AND customer_id IS NULL AND vehicle_id IS NULL)
 OR(employee_advance_id IS NOT NULL AND manual_claim_id IS NULL AND invoice_id IS NULL AND customer_id IS NULL AND vehicle_id IS NULL));
CREATE INDEX collection_employee_advance_history ON ab.collection_attempts(tenant_id,company_id,employee_advance_id,created_at)WHERE employee_advance_id IS NOT NULL;
CREATE OR REPLACE FUNCTION ab.collection_attempt_source_valid()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$DECLARE i ab.vehicle_invoices;t ab.tasks;BEGIN
 IF NEW.employee_advance_id IS NOT NULL THEN
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF NEW.invoice_id IS NOT NULL OR NEW.manual_claim_id IS NOT NULL OR NEW.customer_id IS NOT NULL OR NEW.vehicle_id IS NOT NULL OR t.id IS NULL OR t.source_type IS DISTINCT FROM 'collection_employee_advance' OR t.source_id IS DISTINCT FROM NEW.employee_advance_id OR t.company_id IS DISTINCT FROM NEW.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid OR NOT EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=NEW.tenant_id AND key='employee-advances-v1:records:'||NEW.company_id::text||':'||NEW.employee_advance_id::text) OR NOT EXISTS(SELECT 1 FROM ab.finance_journals j WHERE j.company_id=NEW.company_id AND j.source_key IN('employee-advance-cash:'||NEW.employee_advance_id::text,'employee-advance-receive:'||NEW.employee_advance_id::text) AND j.status='Posted' AND NOT EXISTS(SELECT 1 FROM ab.finance_journals x WHERE x.reversal_of=j.id)) THEN RAISE EXCEPTION 'collection employee advance source mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
 END IF;
 IF NEW.manual_claim_id IS NULL THEN
 SELECT * INTO i FROM ab.vehicle_invoices WHERE id=NEW.invoice_id AND tenant_id=NEW.tenant_id;
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF i.company_id IS DISTINCT FROM NEW.company_id OR i.customer_id IS DISTINCT FROM NEW.customer_id OR i.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR t.source_type IS DISTINCT FROM 'collection_invoice'OR t.source_id IS DISTINCT FROM i.id OR t.company_id IS DISTINCT FROM i.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'collection attempt source mismatch' USING ERRCODE='23514';END IF;RETURN NEW;

 ELSE
 SELECT * INTO t FROM ab.tasks WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id;
 IF NEW.invoice_id IS NOT NULL OR NEW.customer_id IS NOT NULL OR NEW.vehicle_id IS NOT NULL OR t.id IS NULL OR t.source_type IS DISTINCT FROM 'collection_claim' OR t.source_id IS DISTINCT FROM NEW.manual_claim_id OR t.company_id IS DISTINCT FROM NEW.company_id OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid OR NOT EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=NEW.tenant_id AND key='manual-receivable-claim-v1:records:'||NEW.company_id::text||':'||NEW.manual_claim_id::text) OR NOT EXISTS(SELECT 1 FROM ab.finance_journals j WHERE j.company_id=NEW.company_id AND j.source_key='manual-claim:'||NEW.manual_claim_id::text AND j.status='Posted'AND NOT EXISTS(SELECT 1 FROM ab.finance_journals x WHERE x.reversal_of=j.id)) THEN RAISE EXCEPTION 'collection claim source mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
 END IF;
END$$;
CREATE FUNCTION ab.employee_advance_collection_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'EMPLOYEE-ADVANCE-COLLECTION-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.employee_advance_collection_schema_version()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.employee_advance_collection_schema_version()TO ab_runtime;
