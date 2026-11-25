-- REVIEW ONLY. Original ledger posting remains a separate authorized operation.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('ab.cross_branch_receiving_site(uuid)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ab_runtime')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated') AND pg_has_role(oid,'ab_runtime','MEMBER'))
 THEN RAISE EXCEPTION 'private cross-branch prerequisites required' USING ERRCODE='42501'; END IF;
END$$;

CREATE TABLE ab.cross_branch_collection_intake (
 tenant_id uuid NOT NULL REFERENCES ab.organizations,
 id uuid NOT NULL,
 company_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 reported_by uuid NOT NULL,
 amount numeric(21,3) NOT NULL CHECK(amount>0),
 received_on date NOT NULL,
 centre_id uuid NOT NULL,
 centre_source_id uuid NOT NULL,
 location_source_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES ab.vehicle_invoices(tenant_id,id),
 FOREIGN KEY(tenant_id,reported_by) REFERENCES ab.users(tenant_id,id)
);

CREATE FUNCTION ab.cross_branch_intake_valid(target_invoice uuid,debt_company uuid,cash_amount numeric,
 day_received date,centre uuid,centre_version uuid,location_version uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE org uuid:=ab.tenant(); site jsonb;
BEGIN
 IF current_user<>'postgres' OR org IS NULL OR cash_amount IS NULL OR cash_amount<=0
    OR day_received IS DISTINCT FROM timezone('Asia/Dubai',transaction_timestamp())::date THEN RETURN false;END IF;
 site:=ab.cross_branch_receiving_site(debt_company);
 IF site->>'centreId' IS DISTINCT FROM centre::text
    OR site->>'centreSourceId' IS DISTINCT FROM centre_version::text
    OR site->>'locationSourceId' IS DISTINCT FROM location_version::text THEN RETURN false;END IF;
 RETURN EXISTS(
   SELECT 1 FROM ab.vehicle_invoices i
   JOIN ab.customers p ON p.tenant_id=i.tenant_id AND p.id=i.customer_id AND p.status='Active'
   JOIN ab.finance_invoice_links l ON l.tenant_id=i.tenant_id AND l.company_id=i.company_id AND l.invoice_id=i.id
   JOIN ab.finance_items it ON it.tenant_id=l.tenant_id AND it.id=l.item_id AND it.active
   WHERE i.tenant_id=org AND i.id=target_invoice AND i.company_id=debt_company
     AND i.currency='AED' AND to_jsonb(i)->>'contracting_company_id' IS NULL
     AND NOT EXISTS(SELECT 1 FROM ab.vehicle_invoice_adjustments a
                    WHERE a.tenant_id=org AND a.invoice_id=i.id AND a.kind='writeoff')
     AND cash_amount<=i.amount-ab.financial_allocation_total(i.id)-coalesce(
         (SELECT sum(a.amount) FROM ab.vehicle_invoice_adjustments a
          WHERE a.tenant_id=org AND a.invoice_id=i.id AND a.kind<>'writeoff'),0)
 );
END$$;
REVOKE ALL ON FUNCTION ab.cross_branch_intake_valid(uuid,uuid,numeric,date,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.cross_branch_intake_valid(uuid,uuid,numeric,date,uuid,uuid,uuid) TO ab_runtime;

CREATE FUNCTION ab.cross_branch_intake_invoice(target_invoice uuid,debt_company uuid,
 day_received date,centre uuid,centre_version uuid,location_version uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE org uuid:=ab.tenant();
BEGIN
 IF current_user<>'postgres' OR NOT ab.cross_branch_intake_valid(
   target_invoice,debt_company,0.001,day_received,centre,centre_version,location_version)
 THEN RETURN NULL;END IF;
 RETURN (SELECT jsonb_build_object('id',i.id,'companyId',i.company_id,'number',i.invoice_number::text,
             'currency',i.currency,'outstanding',(i.amount-ab.financial_allocation_total(i.id)-coalesce(
              (SELECT sum(a.amount) FROM ab.vehicle_invoice_adjustments a
              WHERE a.tenant_id=org AND a.invoice_id=i.id AND a.kind<>'writeoff'),0))::text)
         FROM ab.vehicle_invoices i WHERE i.tenant_id=org AND i.company_id=debt_company AND i.id=target_invoice);
END$$;
REVOKE ALL ON FUNCTION ab.cross_branch_intake_invoice(uuid,uuid,date,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.cross_branch_intake_invoice(uuid,uuid,date,uuid,uuid,uuid) TO ab_runtime;

ALTER TABLE ab.cross_branch_collection_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.cross_branch_collection_intake FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ab.cross_branch_collection_intake FROM PUBLIC,ab_runtime;
GRANT SELECT,INSERT ON ab.cross_branch_collection_intake TO ab_runtime;
CREATE POLICY cross_branch_intake_read ON ab.cross_branch_collection_intake FOR SELECT TO ab_runtime
 USING(tenant_id=(SELECT ab.tenant()) AND (SELECT ab.hr_actor_allowed()) AND
       ((SELECT ab.operating_centre_owner()) OR (
         reported_by=nullif(current_setting('ab.actor',true),'')::uuid AND EXISTS(
          SELECT 1 FROM ab.permission_grants g
          JOIN ab.users issuer ON issuer.tenant_id=g.tenant_id AND issuer.id=g.issuer_id
          WHERE g.tenant_id=cross_branch_collection_intake.tenant_id
            AND g.user_id=cross_branch_collection_intake.reported_by
            AND g.company_id=cross_branch_collection_intake.company_id
            AND g.permission_id='ledger_cross_branch_collect' AND g.scope_type='company'
            AND g.revoked_at IS NULL AND issuer.role_id='owner' AND issuer.status='Active'
         ))));
CREATE POLICY cross_branch_intake_insert ON ab.cross_branch_collection_intake FOR INSERT TO ab_runtime
 WITH CHECK(tenant_id=(SELECT ab.tenant()) AND reported_by=nullif(current_setting('ab.actor',true),'')::uuid
            AND created_at=transaction_timestamp()
            AND ab.cross_branch_intake_valid(invoice_id,company_id,amount,received_on,centre_id,centre_source_id,location_source_id));
CREATE TABLE ab.cross_branch_collection_posting (
 tenant_id uuid NOT NULL,
 intake_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 posted_by uuid NOT NULL,
 PRIMARY KEY(tenant_id,intake_id),
 UNIQUE(tenant_id,batch_id),
 FOREIGN KEY(tenant_id,intake_id) REFERENCES ab.cross_branch_collection_intake(tenant_id,id),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES ab.finance_receipt_batches(tenant_id,id),
 FOREIGN KEY(tenant_id,posted_by) REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.cross_branch_collection_posting ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.cross_branch_collection_posting FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ab.cross_branch_collection_posting FROM PUBLIC,ab_runtime;
GRANT SELECT,INSERT ON ab.cross_branch_collection_posting TO ab_runtime;
CREATE POLICY cross_branch_posting_read ON ab.cross_branch_collection_posting FOR SELECT TO ab_runtime
 USING(tenant_id=(SELECT ab.tenant()) AND (SELECT ab.hr_actor_allowed()) AND EXISTS(
  SELECT 1 FROM ab.cross_branch_collection_intake i WHERE i.tenant_id=cross_branch_collection_posting.tenant_id AND i.id=cross_branch_collection_posting.intake_id
 ));
CREATE POLICY cross_branch_posting_insert ON ab.cross_branch_collection_posting FOR INSERT TO ab_runtime
 WITH CHECK(tenant_id=(SELECT ab.tenant()) AND (SELECT ab.operating_centre_owner()) AND (SELECT ab.hr_actor_allowed())
   AND posted_by=nullif(current_setting('ab.actor',true),'')::uuid
   AND EXISTS(
     SELECT 1 FROM ab.cross_branch_collection_intake i
     JOIN ab.finance_receipt_batches b ON b.tenant_id=i.tenant_id AND b.company_id=i.company_id
     JOIN ab.finance_receipts r ON r.tenant_id=b.tenant_id AND r.company_id=b.company_id AND r.batch_id=b.id
     JOIN ab.vehicle_allocations a ON a.tenant_id=i.tenant_id AND a.company_id=i.company_id
       AND a.invoice_id=i.invoice_id AND a.receipt_id=r.id
     WHERE i.tenant_id=cross_branch_collection_posting.tenant_id AND i.id=cross_branch_collection_posting.intake_id
       AND b.id=cross_branch_collection_posting.batch_id AND b.created_by=cross_branch_collection_posting.posted_by
       AND i.reported_by<>b.created_by AND r.holder_id=i.reported_by
       AND b.method='cash' AND b.currency='AED' AND r.payment_state='Cleared'
       AND b.received_on=i.received_on AND b.amount=i.amount AND r.amount=i.amount AND a.amount=i.amount
       AND EXISTS(SELECT 1 FROM ab.finance_journals j WHERE j.tenant_id=i.tenant_id AND j.company_id=i.company_id
                  AND j.status='Posted' AND j.source_key='receipt:'||r.id::text)
       AND EXISTS(SELECT 1 FROM ab.finance_custody_moves m WHERE m.tenant_id=i.tenant_id AND m.company_id=i.company_id
                  AND m.receipt_id=r.id AND m.holder_id=i.reported_by AND m.amount=i.amount AND m.source_key='collect:'||r.id::text)
   ));
COMMIT;
