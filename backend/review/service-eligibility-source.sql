-- REVIEW ONLY: not installed by runtime, deployment manifest or schema migrations.
-- Private source for the approved two-actual-due-months policy. Original HTTP action permissions still apply.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND(rolsuper OR rolbypassrls))
 OR to_regprocedure('ab.customer_identity_in_scope(uuid)')IS NULL OR to_regprocedure('ab.hr_actor_allowed()')IS NULL
 OR to_regprocedure('ab.financial_allocation_total(uuid)')IS NULL THEN RAISE EXCEPTION 'reviewed source prerequisites required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ab_runtime' AND NOT rolsuper AND NOT rolbypassrls)
 OR EXISTS(SELECT 1 FROM pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated')AND pg_has_role(oid,'ab_runtime','MEMBER'))
 THEN RAISE EXCEPTION 'private non-bypass runtime required' USING ERRCODE='42501';END IF;
END$$;
CREATE FUNCTION ab.service_eligibility_source_snapshot(target_customer pg_catalog.uuid,as_of pg_catalog.date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE org pg_catalog.uuid:=ab.tenant();principal pg_catalog.uuid:=nullif(current_setting('ab.actor',true),'')::pg_catalog.uuid;
 principal_role text;packet jsonb;header jsonb;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'reviewed source owner required' USING ERRCODE='42501';END IF;
 SELECT role_id INTO principal_role FROM ab.users WHERE tenant_id=org AND id=principal AND status='Active';
 IF NOT FOUND OR principal_role='investor' OR NOT ab.hr_actor_allowed() OR as_of IS DISTINCT FROM timezone('Asia/Dubai',transaction_timestamp())::date
 THEN RAISE EXCEPTION 'actual active work actor and current date required' USING ERRCODE='42501';END IF;
 header:=jsonb_build_object('format','AB-SERVICE-ELIGIBILITY-SOURCE-1','actorId',principal,'tenantId',org,'customerId',target_customer,'asOf',as_of,'purposeOnly',true,'sourceWrites',false);
 -- Unconfigured legacy visibility must NOT become privileged financial disclosure.
 IF principal_role<>'owner' AND NOT EXISTS(SELECT 1 FROM ab.user_access_scope_versions WHERE tenant_id=org AND user_id=principal)
 THEN RETURN header||jsonb_build_object('reviewRequired','actual_actor_scope_required');END IF;
 IF NOT ab.customer_identity_in_scope(target_customer) THEN RAISE EXCEPTION 'customer outside actual work scope' USING ERRCODE='42501';END IF;
 WITH companies AS MATERIALIZED(SELECT id FROM ab.companies WHERE tenant_id=org ORDER BY id LIMIT 101),
 invoices AS MATERIALIZED(
 SELECT i.id,i.company_id,i.vehicle_id,i.contract_id,i.kind,i.source_key,i.due_on,i.amount::text,i.currency,i.payload_cipher,it.category,ab.financial_allocation_total(i.id)::text paid
 FROM ab.vehicle_invoices i LEFT JOIN ab.finance_invoice_links l ON l.tenant_id=i.tenant_id AND l.invoice_id=i.id
 LEFT JOIN ab.finance_items it ON it.tenant_id=l.tenant_id AND it.id=l.item_id
 WHERE i.tenant_id=org AND i.customer_id=target_customer AND i.due_on<=as_of AND(i.kind IN('finance','service')OR it.category='loan')
 ORDER BY i.due_on,i.id LIMIT 20001),
 adjustments AS MATERIALIZED(
 SELECT a.invoice_id,a.kind,a.amount::text,meta.value->'index'->>'documentType' document_type
 FROM ab.vehicle_invoice_adjustments a LEFT JOIN ab.settings meta ON meta.tenant_id=a.tenant_id AND meta.key='financial-package-v1:documents:'||a.company_id::text||':'||a.id::text
 WHERE a.tenant_id=org AND a.invoice_id IN(SELECT id FROM invoices) ORDER BY a.id LIMIT 20001),
 contracts AS MATERIALIZED(
 SELECT r.id,r.company_id,r.vehicle_id,r.payload_cipher FROM ab.vehicle_contracts r WHERE r.tenant_id=org
 AND EXISTS(SELECT 1 FROM invoices i WHERE i.contract_id=r.id AND i.company_id=r.company_id AND i.vehicle_id=r.vehicle_id)
 ORDER BY r.id LIMIT 20001),
 confirmations AS MATERIALIZED(
 SELECT e.tenant_id,e.company_id,e.vehicle_id,e.payload_cipher FROM ab.vehicle_events e WHERE e.tenant_id=org AND e.kind='contract_confirmed'
 AND EXISTS(SELECT 1 FROM contracts r WHERE r.company_id=e.company_id AND r.vehicle_id=e.vehicle_id) ORDER BY e.id LIMIT 20001),
 credits AS MATERIALIZED(
 SELECT r.company_id,r.currency,r.amount::text,(coalesce((SELECT sum(a.amount)FROM ab.vehicle_allocations a WHERE a.tenant_id=org AND a.receipt_id=r.id
 AND NOT EXISTS(SELECT 1 FROM ab.finance_allocation_reversals x WHERE x.tenant_id=org AND x.allocation_id=a.id)),0)
 +coalesce((SELECT sum(x.amount)FROM ab.finance_credit_applications x JOIN ab.finance_receipts y ON y.tenant_id=x.tenant_id AND y.id=x.application_receipt_id
 WHERE x.tenant_id=org AND x.source_receipt_id=r.id AND y.payment_state='Cleared'),0))::text allocated
 FROM ab.finance_receipts r WHERE r.tenant_id=org AND r.customer_id=target_customer AND r.kind<>'credit' AND r.payment_state='Cleared' ORDER BY r.id LIMIT 20001),
 case_books AS MATERIALIZED(
 SELECT t.id,s.value FROM ab.communication_threads t JOIN ab.settings s ON s.tenant_id=t.tenant_id AND s.key='communication-cases-v1:'||t.id::text
 WHERE t.tenant_id=org AND((t.source_type='customer'AND t.source_id=target_customer)
 OR(t.source_type='vehicle'AND EXISTS(SELECT 1 FROM ab.vehicle_invoices v WHERE v.tenant_id=org AND v.customer_id=target_customer AND v.vehicle_id=t.source_id))
 OR(t.source_type='invoice'AND t.source_id IN(SELECT id FROM invoices WHERE kind IN('finance','service')))) ORDER BY t.id LIMIT 501)
 SELECT header||jsonb_build_object('companyCount',(SELECT count(*)FROM ab.companies WHERE tenant_id=org),
 'companies',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb)FROM companies),
 'invoices',(SELECT coalesce(jsonb_agg(to_jsonb(i)ORDER BY due_on,id),'[]'::jsonb)FROM invoices i),
 'adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb)FROM adjustments a),
 'contracts',(SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY id),'[]'::jsonb)FROM contracts r),
 'confirmations',(SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb)FROM confirmations e),
 'credits',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)FROM credits r),
 'caseBooks',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]'::jsonb)FROM case_books t))INTO packet;
 IF octet_length(packet::text)>8388608 THEN RETURN header||jsonb_build_object('reviewRequired','source_payload_budget_exceeded');END IF;
 RETURN packet;
END$$;
REVOKE ALL ON FUNCTION ab.service_eligibility_source_snapshot(pg_catalog.uuid,pg_catalog.date)FROM PUBLIC;
DO $$DECLARE role_name text;BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN('anon','authenticated')LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION ab.service_eligibility_source_snapshot(uuid,date)FROM %I',role_name);END LOOP;
END$$;
GRANT EXECUTE ON FUNCTION ab.service_eligibility_source_snapshot(pg_catalog.uuid,pg_catalog.date)TO ab_runtime;
COMMIT;
