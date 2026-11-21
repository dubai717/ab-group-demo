-- REVIEW ONLY. Requires separately reviewed manual-claim-receipts.review-only.sql.
-- No hosted activation, cash guard relaxation, historical adoption or balance migration.
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('ab.manual_claim_receipt_valid()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='89b02a011be7a8afd9e06b856472ebaf7013839454020f4a33284c5156566484') THEN RAISE EXCEPTION 'unreviewed original non-sales receipt guard' USING ERRCODE='23514';END IF;
END$$;
ALTER TABLE ab.manual_claim_receipt_sources ADD COLUMN bank_operation_id uuid,
 ADD CONSTRAINT manual_claim_bank_source_fk FOREIGN KEY(tenant_id,bank_operation_id)REFERENCES ab.finance_operations(tenant_id,id),
 ADD CONSTRAINT manual_claim_bank_source_once UNIQUE(tenant_id,bank_operation_id);
CREATE OR REPLACE FUNCTION ab.manual_claim_receipt_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r ab.finance_receipts;op ab.finance_operations;principal numeric;recovered numeric;BEGIN
 SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.receipt_id AND tenant_id=NEW.tenant_id;
 IF r.id IS NULL OR r.company_id IS DISTINCT FROM NEW.company_id OR r.amount IS DISTINCT FROM NEW.amount OR r.payment_state<>'Cleared' OR r.currency<>'AED' OR r.customer_id IS NOT NULL OR r.contracting_company_id IS NOT NULL OR r.vehicle_id IS NOT NULL OR r.item_id IS NOT NULL OR r.created_by IS DISTINCT FROM NEW.created_by OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'invalid non-sales receipt source' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=NEW.tenant_id AND key='manual-receivable-claim-v1:records:'||NEW.company_id::text||':'||NEW.claim_id::text AND value->'index'->>'receivableChartId'=NEW.receivable_chart_id::text)THEN RAISE EXCEPTION 'missing original reviewed claim' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(e.debit-e.credit),0)INTO principal FROM ab.finance_entries e JOIN ab.finance_journals j ON j.id=e.journal_id WHERE j.company_id=NEW.company_id AND j.status='Posted' AND e.chart_id=NEW.receivable_chart_id AND(j.source_key='manual-claim:'||NEW.claim_id::text OR j.reversal_of IN(SELECT id FROM ab.finance_journals WHERE company_id=NEW.company_id AND source_key='manual-claim:'||NEW.claim_id::text));
 SELECT coalesce(sum(amount),0)INTO recovered FROM ab.manual_claim_receipt_sources WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND claim_id=NEW.claim_id;
 IF recovered>principal THEN RAISE EXCEPTION 'non-sales receipt exceeds original claim' USING ERRCODE='23514';END IF;
 IF NEW.bank_operation_id IS NULL THEN
  IF r.kind<>'cash' OR NOT EXISTS(SELECT 1 FROM ab.finance_entries e JOIN ab.finance_journals j ON j.id=e.journal_id WHERE j.company_id=NEW.company_id AND j.source_key='receipt:'||NEW.receipt_id::text AND j.status='Posted' AND e.chart_id=NEW.receivable_chart_id AND e.credit-e.debit=NEW.amount)THEN RAISE EXCEPTION 'non-sales cash receipt not covered by original journal' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO op FROM ab.finance_operations WHERE id=NEW.bank_operation_id AND tenant_id=NEW.tenant_id;
  IF r.kind<>'transfer' OR r.deposit_operation_id IS DISTINCT FROM op.id OR op.id IS NULL OR op.status<>'Approved' OR op.kind<>'receipt' OR op.company_id IS DISTINCT FROM NEW.company_id OR op.currency<>'AED' OR op.amount IS DISTINCT FROM NEW.amount OR op.counterpart_id IS DISTINCT FROM NEW.receivable_chart_id OR (op.integration_refs->>'manualClaimReference') IS DISTINCT FROM NEW.claim_id::text OR nullif(op.integration_refs->>'clientReference','') IS NOT NULL OR nullif(op.integration_refs->>'vehicleReference','') IS NOT NULL OR nullif(op.integration_refs->>'contractingCompanyReference','') IS NOT NULL OR op.document_version_id IS NULL OR op.cheque_id IS NOT NULL OR r.received_on IS DISTINCT FROM op.effective_on OR (SELECT coalesce(sum(e.credit-e.debit),0)FROM ab.finance_entries e WHERE e.operation_id=op.id AND e.chart_id=NEW.receivable_chart_id) IS DISTINCT FROM NEW.amount OR EXISTS(SELECT 1 FROM ab.finance_custody_moves WHERE receipt_id=r.id)THEN RAISE EXCEPTION 'non-sales transfer not covered by original approved bank receipt' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END$$;
CREATE FUNCTION ab.manual_claim_bank_receipt_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'MANUAL-CLAIM-BANK-RECEIPTS-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.manual_claim_bank_receipt_schema_version()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.manual_claim_bank_receipt_schema_version()TO ab_runtime;
