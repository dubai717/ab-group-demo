-- REVIEW ONLY. Never add to protected delivery catalog without financial migration approval.
-- Reuses original RVs and custody moves. No historical adoption or balance movement.
DO $$BEGIN
 IF (SELECT prosrc FROM pg_proc WHERE oid='ab.financial_custody_valid()'::regprocedure) IS DISTINCT FROM $guard$DECLARE r ab.finance_receipts;BEGIN SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.receipt_id AND tenant_id=NEW.tenant_id;IF r.item_id IS NULL OR r.kind NOT IN('cash','cheque') OR NEW.company_id IS DISTINCT FROM r.company_id OR NEW.currency IS DISTINCT FROM r.currency OR EXISTS(SELECT 1 FROM ab.finance_custody_moves WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.receipt_id GROUP BY holder_id HAVING sum(amount)<0)OR(SELECT sum(amount)FROM ab.finance_custody_moves WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.receipt_id)>r.amount THEN RAISE EXCEPTION 'invalid custody balance' USING ERRCODE='23514';END IF;RETURN NULL;END $guard$ THEN RAISE EXCEPTION 'unreviewed original custody guard' USING ERRCODE='23514';END IF;
END$$;
CREATE TABLE ab.manual_claim_receipt_sources(
 receipt_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,claim_id uuid NOT NULL,
 receivable_chart_id uuid NOT NULL,amount numeric(21,3) NOT NULL CHECK(amount>0),created_by uuid NOT NULL,
 FOREIGN KEY(tenant_id,receipt_id)REFERENCES ab.finance_receipts(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,receivable_chart_id)REFERENCES ab.finance_chart(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id),UNIQUE(tenant_id,receipt_id));
ALTER TABLE ab.manual_claim_receipt_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.manual_claim_receipt_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.manual_claim_receipt_sources USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.manual_claim_receipt_sources TO ab_runtime;
CREATE FUNCTION ab.manual_claim_receipt_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r ab.finance_receipts;principal numeric;recovered numeric;BEGIN
 SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.receipt_id AND tenant_id=NEW.tenant_id;
 IF r.id IS NULL OR r.company_id IS DISTINCT FROM NEW.company_id OR r.amount IS DISTINCT FROM NEW.amount OR r.kind<>'cash' OR r.payment_state<>'Cleared' OR r.currency<>'AED' OR r.customer_id IS NOT NULL OR r.contracting_company_id IS NOT NULL OR r.vehicle_id IS NOT NULL OR r.item_id IS NOT NULL OR r.created_by IS DISTINCT FROM NEW.created_by OR NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'invalid non-sales receipt source' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=NEW.tenant_id AND key='manual-receivable-claim-v1:records:'||NEW.company_id::text||':'||NEW.claim_id::text AND value->'index'->>'receivableChartId'=NEW.receivable_chart_id::text)THEN RAISE EXCEPTION 'missing original reviewed claim' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(e.debit-e.credit),0)INTO principal FROM ab.finance_entries e JOIN ab.finance_journals j ON j.id=e.journal_id WHERE j.company_id=NEW.company_id AND j.status='Posted' AND e.chart_id=NEW.receivable_chart_id AND(j.source_key='manual-claim:'||NEW.claim_id::text OR j.reversal_of IN(SELECT id FROM ab.finance_journals WHERE company_id=NEW.company_id AND source_key='manual-claim:'||NEW.claim_id::text));
 SELECT coalesce(sum(amount),0)INTO recovered FROM ab.manual_claim_receipt_sources WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND claim_id=NEW.claim_id;
 IF recovered>principal OR NOT EXISTS(SELECT 1 FROM ab.finance_entries e JOIN ab.finance_journals j ON j.id=e.journal_id WHERE j.company_id=NEW.company_id AND j.source_key='receipt:'||NEW.receipt_id::text AND j.status='Posted' AND e.chart_id=NEW.receivable_chart_id AND e.credit-e.debit=NEW.amount)THEN RAISE EXCEPTION 'non-sales receipt not covered by original claim and journal' USING ERRCODE='23514';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER manual_claim_receipt_valid AFTER INSERT ON ab.manual_claim_receipt_sources DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.manual_claim_receipt_valid();
CREATE FUNCTION ab.manual_claim_receipt_immutable()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF EXISTS(SELECT 1 FROM ab.manual_claim_receipt_sources WHERE tenant_id=OLD.tenant_id AND receipt_id=OLD.id) THEN RAISE EXCEPTION 'immutable non-sales receipt; documented correction required' USING ERRCODE='23514';END IF;IF TG_OP='DELETE'THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER manual_claim_receipt_immutable BEFORE UPDATE OR DELETE ON ab.finance_receipts FOR EACH ROW EXECUTE FUNCTION ab.manual_claim_receipt_immutable();
CREATE OR REPLACE FUNCTION ab.financial_custody_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r ab.finance_receipts;BEGIN SELECT * INTO r FROM ab.finance_receipts WHERE id=NEW.receipt_id AND tenant_id=NEW.tenant_id;IF (r.item_id IS NULL AND NOT EXISTS(SELECT 1 FROM ab.manual_claim_receipt_sources s WHERE s.tenant_id=NEW.tenant_id AND s.receipt_id=r.id AND s.company_id=r.company_id AND s.amount=r.amount)) OR r.kind NOT IN('cash','cheque') OR NEW.company_id IS DISTINCT FROM r.company_id OR NEW.currency IS DISTINCT FROM r.currency OR EXISTS(SELECT 1 FROM ab.finance_custody_moves WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.receipt_id GROUP BY holder_id HAVING sum(amount)<0)OR(SELECT sum(amount)FROM ab.finance_custody_moves WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.receipt_id)>r.amount THEN RAISE EXCEPTION 'invalid custody balance' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE FUNCTION ab.manual_claim_receipt_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'MANUAL-CLAIM-RECEIPTS-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.manual_claim_receipt_valid(),ab.manual_claim_receipt_immutable(),ab.manual_claim_receipt_schema_version()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.manual_claim_receipt_schema_version()TO ab_runtime;
