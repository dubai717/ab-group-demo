-- REVIEW ONLY: not in manifests, no financial writes or implicit grants.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.hr_actor_allowed()')IS NULL OR to_regprocedure('ab.financial_allocation_total(uuid)')IS NULL THEN RAISE EXCEPTION 'reviewed original prerequisites required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_has_role('ab_runtime',oid,'MEMBER'))OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated')AND pg_has_role(oid,'ab_runtime','MEMBER'))THEN RAISE EXCEPTION 'private non-bypass runtime required' USING ERRCODE='42501';END IF;
END$$;
INSERT INTO ab.permissions(id)VALUES('ledger_cross_branch_collect')ON CONFLICT DO NOTHING;
CREATE FUNCTION ab.cross_branch_collection_source(target_customer pg_catalog.uuid,legal_company pg_catalog.uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE org uuid:=ab.tenant();principal uuid:=nullif(current_setting('ab.actor',true),'')::uuid;principal_role text;header jsonb;packet jsonb;total bigint;bytes bigint;
BEGIN
 IF current_user<>'postgres'THEN RAISE EXCEPTION 'reviewed source owner required' USING ERRCODE='42501';END IF;
 SELECT role_id INTO principal_role FROM ab.users WHERE tenant_id=org AND id=principal AND status='Active';
 IF NOT FOUND OR principal_role='investor'OR NOT ab.hr_actor_allowed()THEN RAISE EXCEPTION 'actual active work actor required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.companies WHERE tenant_id=org AND id=legal_company)OR(principal_role<>'owner'AND NOT EXISTS(
 SELECT 1 FROM ab.permission_grants g JOIN ab.users issuer ON issuer.tenant_id=g.tenant_id AND issuer.id=g.issuer_id AND issuer.role_id='owner'AND issuer.status='Active'
 WHERE g.tenant_id=org AND g.user_id=principal AND g.permission_id='ledger_cross_branch_collect'AND g.revoked_at IS NULL AND g.scope_type='company'AND g.company_id=legal_company))
 THEN RAISE EXCEPTION 'explicit original company collection grant required' USING ERRCODE='42501';END IF;
 header:=jsonb_build_object('format','AB-CROSS-BRANCH-COLLECTION-SOURCE-1','actorId',principal,'tenantId',org,'customerId',target_customer,'companyId',legal_company,'purposeOnly',true,'sourceWrites',false);
 -- Encrypted narrowing exceptions need original application decoding. Do not bypass them
 -- in this first source candidate. No grant inheritance/delegation is inferred here.
 IF principal_role<>'owner'AND EXISTS(SELECT 1 FROM ab.settings WHERE tenant_id=org AND key='user-denials-v1:'||principal::text)THEN RETURN header||jsonb_build_object('reviewRequired','individual_denial_source_review');END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.vehicle_invoices WHERE tenant_id=org AND company_id=legal_company AND customer_id=target_customer)THEN RAISE EXCEPTION 'no original company/customer receivable relationship' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.customers WHERE tenant_id=org AND id=target_customer)THEN RAISE EXCEPTION 'customer not found' USING ERRCODE='42501';END IF;
 SELECT count(*),coalesce(sum(octet_length(payload_cipher)),0)INTO total,bytes FROM ab.customers WHERE tenant_id=org AND id=target_customer;
 IF total<>1 OR bytes>65536 THEN RETURN header||jsonb_build_object('reviewRequired','customer_source_budget');END IF;
 SELECT count(*)INTO total FROM ab.vehicle_invoices WHERE tenant_id=org AND company_id=legal_company AND customer_id=target_customer;
 IF total>100 THEN RETURN header||jsonb_build_object('reviewRequired','invoice_source_budget');END IF;
 IF EXISTS(SELECT 1 FROM ab.vehicle_invoices i JOIN ab.finance_invoice_links l ON l.tenant_id=i.tenant_id AND l.invoice_id=i.id JOIN ab.finance_items it ON it.tenant_id=l.tenant_id AND it.id=l.item_id WHERE i.tenant_id=org AND i.company_id=legal_company AND i.customer_id=target_customer AND(octet_length(it.name_ar)>640 OR octet_length(it.name_en)>640))THEN RETURN header||jsonb_build_object('reviewRequired','item_source_budget');END IF;
 WITH bills AS MATERIALIZED(
 SELECT i.id,i.company_id,i.customer_id,i.vehicle_id,i.invoice_number::text,i.kind,i.currency,i.amount::text,i.due_on::text,ab.financial_allocation_total(i.id)::text paid,l.item_id,it.name_ar,it.name_en
 FROM ab.vehicle_invoices i LEFT JOIN ab.finance_invoice_links l ON l.tenant_id=i.tenant_id AND l.invoice_id=i.id
 LEFT JOIN ab.finance_items it ON it.tenant_id=l.tenant_id AND it.id=l.item_id
 WHERE i.tenant_id=org AND i.company_id=legal_company AND i.customer_id=target_customer ORDER BY i.due_on,i.id LIMIT 101),
 adjustments AS MATERIALIZED(
 SELECT a.id,a.invoice_id,a.kind,a.amount::text,CASE WHEN octet_length(meta.value->'index'->>'documentType')>100 THEN '__REVIEW__'ELSE meta.value->'index'->>'documentType'END document_type FROM ab.vehicle_invoice_adjustments a
 LEFT JOIN ab.settings meta ON meta.tenant_id=a.tenant_id AND meta.key='financial-package-v1:documents:'||a.company_id::text||':'||a.id::text
 WHERE a.tenant_id=org AND a.company_id=legal_company AND a.invoice_id IN(SELECT id FROM bills)ORDER BY a.id LIMIT 1001)
 SELECT CASE WHEN(SELECT count(*)FROM adjustments)>1000 OR EXISTS(SELECT 1 FROM adjustments WHERE document_type='__REVIEW__') THEN header||jsonb_build_object('reviewRequired','adjustment_source_budget')ELSE header||jsonb_build_object(
 'customer',(SELECT jsonb_build_object('id',id,'number',file_number::text,'payload',payload_cipher)FROM ab.customers WHERE tenant_id=org AND id=target_customer),
 'invoices',coalesce((SELECT jsonb_agg(to_jsonb(b)ORDER BY due_on,id)FROM bills b),'[]'),
 'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM adjustments a),'[]'))END INTO packet;
 IF octet_length(packet::text)>262144 THEN RETURN header||jsonb_build_object('reviewRequired','packet_budget');END IF;RETURN packet;
END$$;
REVOKE ALL ON FUNCTION ab.cross_branch_collection_source(uuid,uuid)FROM PUBLIC;
DO $$DECLARE r text;BEGIN FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN('anon','authenticated')LOOP EXECUTE format('REVOKE ALL ON FUNCTION ab.cross_branch_collection_source(uuid,uuid)FROM %I',r);END LOOP;END$$;
GRANT EXECUTE ON FUNCTION ab.cross_branch_collection_source(uuid,uuid)TO ab_runtime;
COMMIT;
