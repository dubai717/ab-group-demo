-- REVIEW ONLY. Excluded from automatic manifests. No financial row is modified.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'reviewed original technical owner required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid IN('ab.finance_handovers'::regclass,'ab.finance_receipts'::regclass) AND polname='reviewed_company_upper_bound' AND NOT polpermissive)<>2 THEN RAISE EXCEPTION 'reviewed custody parent upper bounds required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND(rolsuper OR rolbypassrls))OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname='finance_handover_items'AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own handover child source' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.finance_handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.finance_handover_items FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_handover_item_parents ON ab.finance_handover_items AS RESTRICTIVE FOR ALL TO ab_runtime USING(
 tenant_id=(SELECT ab.tenant())AND(ab.current_company_scope_ids()IS NULL OR EXISTS(
 SELECT 1 FROM ab.finance_handovers h JOIN ab.finance_receipts r ON r.tenant_id=h.tenant_id AND r.company_id=h.company_id
 WHERE h.tenant_id=finance_handover_items.tenant_id AND h.id=finance_handover_items.handover_id AND r.id=finance_handover_items.receipt_id
 )))WITH CHECK(
 tenant_id=(SELECT ab.tenant())AND(ab.current_company_scope_ids()IS NULL OR EXISTS(
 SELECT 1 FROM ab.finance_handovers h JOIN ab.finance_receipts r ON r.tenant_id=h.tenant_id AND r.company_id=h.company_id
 WHERE h.tenant_id=finance_handover_items.tenant_id AND h.id=finance_handover_items.handover_id AND r.id=finance_handover_items.receipt_id
 )));
-- Company upper bound only: original actual sender/receiver, custody, pending, receipt and approval checks remain mandatory.
-- This does not grant cross-branch collection, confirm receipt, transfer cash or post any ledger entry.
COMMIT;
