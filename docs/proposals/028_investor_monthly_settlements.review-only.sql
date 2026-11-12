-- REVIEW ONLY: isolated synthetic database tests only until explicit owner financial approval.
-- Adds empty structures. No old agreement, funding, journal, balance, role, grant or setting is updated.
CREATE TABLE ab.investor_monthly_configurations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,currency char(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 capital_chart_id uuid NOT NULL,payable_chart_id uuid NOT NULL,fee_income_chart_id uuid NOT NULL,payout_item_id uuid NOT NULL,document_version_id uuid NOT NULL,
 accounting_basis text NOT NULL CHECK(accounting_basis='gross_agency_on_collection'),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(capital_chart_id<>payable_chart_id AND payable_chart_id<>fee_income_chart_id AND capital_chart_id<>fee_income_chart_id),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,currency),UNIQUE(tenant_id,company_id,currency,id),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,capital_chart_id)REFERENCES ab.finance_chart(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,payable_chart_id)REFERENCES ab.finance_chart(tenant_id,company_id,id),FOREIGN KEY(tenant_id,company_id,fee_income_chart_id)REFERENCES ab.finance_chart(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,payout_item_id)REFERENCES ab.finance_items(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_monthly_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,investor_id uuid NOT NULL,version_id uuid NOT NULL,configuration_id uuid NOT NULL,currency char(3)NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,version_id),FOREIGN KEY(tenant_id,version_id)REFERENCES ab.investor_agreement_versions(tenant_id,id),FOREIGN KEY(tenant_id,company_id,currency,configuration_id)REFERENCES ab.investor_monthly_configurations(tenant_id,company_id,currency,id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_monthly_invoice_classifications(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,invoice_id uuid NOT NULL,version_id uuid NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,id),FOREIGN KEY(tenant_id,version_id)REFERENCES ab.investor_agreement_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_monthly_settlements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,investor_id uuid NOT NULL,currency char(3) NOT NULL,period char(7) NOT NULL CHECK(period~'^[0-9]{4}-(0[1-9]|1[0-2])$'),
 configuration_id uuid NOT NULL,status text NOT NULL DEFAULT 'Draft'CHECK(status IN('Draft','Reviewed','Approved','Paid','Cancelled')),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 amount numeric(21,3)NOT NULL CHECK(amount>0),voucher_id uuid,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,investor_id,id),UNIQUE(tenant_id,voucher_id),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,currency,configuration_id)REFERENCES ab.investor_monthly_configurations(tenant_id,company_id,currency,id),FOREIGN KEY(tenant_id,voucher_id)REFERENCES ab.finance_vouchers(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX investor_monthly_one_active_period ON ab.investor_monthly_settlements(tenant_id,company_id,investor_id,currency,period)WHERE status<>'Cancelled';
CREATE TABLE ab.investor_monthly_lines(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,investor_id uuid NOT NULL,settlement_id uuid NOT NULL,allocation_id uuid NOT NULL,bank_entry_id uuid NOT NULL,
 receipt_id uuid NOT NULL,funding_id uuid NOT NULL,version_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('installment','registration_share')),
 amount numeric(21,3)NOT NULL CHECK(amount>0),source_amount numeric(21,3)NOT NULL CHECK(source_amount>=amount),released boolean NOT NULL DEFAULT false,payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,investor_id,settlement_id)REFERENCES ab.investor_monthly_settlements(tenant_id,company_id,investor_id,id),
 FOREIGN KEY(tenant_id,allocation_id)REFERENCES ab.vehicle_allocations(tenant_id,id),FOREIGN KEY(tenant_id,bank_entry_id)REFERENCES ab.finance_entries(tenant_id,id),
 FOREIGN KEY(tenant_id,receipt_id)REFERENCES ab.finance_receipts(tenant_id,id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),
 FOREIGN KEY(tenant_id,version_id)REFERENCES ab.investor_agreement_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX investor_monthly_source_claim ON ab.investor_monthly_lines(tenant_id,allocation_id,bank_entry_id,kind)WHERE NOT released;
CREATE INDEX investor_monthly_line_receipt ON ab.investor_monthly_lines(tenant_id,receipt_id,bank_entry_id)WHERE NOT released;
CREATE TABLE ab.investor_monthly_exclusions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,investor_id uuid NOT NULL,settlement_id uuid NOT NULL,source_key text NOT NULL,amount numeric(21,3)NOT NULL CHECK(amount>0),reason text NOT NULL CHECK(length(btrim(reason))>0),payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,settlement_id,source_key),FOREIGN KEY(tenant_id,company_id,investor_id,settlement_id)REFERENCES ab.investor_monthly_settlements(tenant_id,company_id,investor_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE FUNCTION ab.investor_monthly_insert_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
BEGIN
 IF NEW.tenant_id<>ab.tenant()OR NEW.created_by<>nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'monthly_insert_denied' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='investor_monthly_invoice_classifications'THEN
  IF NOT ab.investor_monthly_existing_right(NEW.company_id,ARRAY['ledger_invoice_create'])OR NOT ab.investor_monthly_existing_right(NEW.company_id,ARRAY['ledger_journal_approve'])THEN RAISE EXCEPTION 'monthly_invoice_classification_denied' USING ERRCODE='42501';END IF;
 ELSE IF NOT ab.investor_registry_owner()THEN RAISE EXCEPTION 'monthly_insert_denied' USING ERRCODE='42501';END IF;END IF;
 IF TG_TABLE_NAME='investor_monthly_settlements'THEN IF NEW.status<>'Draft'OR NEW.revision<>1 OR NEW.voucher_id IS NOT NULL THEN RAISE EXCEPTION 'monthly_initial_state_invalid' USING ERRCODE='23514';END IF;END IF;
 IF TG_TABLE_NAME='investor_monthly_exclusions'THEN IF NOT EXISTS(SELECT 1 FROM ab.investor_monthly_settlements s WHERE s.id=NEW.settlement_id AND s.tenant_id=NEW.tenant_id AND s.status='Draft')THEN RAISE EXCEPTION 'monthly_draft_required' USING ERRCODE='23514';END IF;END IF;
 IF TG_TABLE_NAME='investor_monthly_versions'THEN
  IF NOT EXISTS(SELECT 1 FROM ab.investor_agreement_versions v JOIN ab.investor_agreement_series s ON s.id=v.series_id AND s.tenant_id=v.tenant_id WHERE v.id=NEW.version_id AND v.tenant_id=NEW.tenant_id AND v.created_at=transaction_timestamp()AND v.created_by=NEW.created_by AND s.company_id=NEW.company_id AND s.investor_id=NEW.investor_id AND s.currency=NEW.currency)THEN RAISE EXCEPTION 'monthly_new_version_only' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_TABLE_NAME='investor_monthly_configurations'THEN
  IF NOT EXISTS(SELECT 1 FROM ab.finance_chart WHERE id=NEW.capital_chart_id AND tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND currency=NEW.currency AND kind='liability')OR NOT EXISTS(SELECT 1 FROM ab.finance_chart WHERE id=NEW.payable_chart_id AND tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND currency=NEW.currency AND kind='liability')OR NOT EXISTS(SELECT 1 FROM ab.finance_chart WHERE id=NEW.fee_income_chart_id AND tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND currency=NEW.currency AND kind='income')THEN RAISE EXCEPTION 'monthly_accounts_invalid' USING ERRCODE='23514';END IF;
  IF NOT EXISTS(SELECT 1 FROM ab.document_versions v JOIN ab.documents d ON d.id=v.document_id AND d.tenant_id=v.tenant_id WHERE v.id=NEW.document_version_id AND v.tenant_id=NEW.tenant_id AND d.company_id=NEW.company_id AND v.scan_status='clean'AND NOT EXISTS(SELECT 1 FROM ab.audit_events a WHERE a.tenant_id=NEW.tenant_id AND a.entity_type='document'AND a.entity_id=d.id::text AND a.action='attachment_withdrawn'))THEN RAISE EXCEPTION 'monthly_policy_document_required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END$$;
CREATE FUNCTION ab.investor_monthly_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE v ab.finance_vouchers; matched boolean; total numeric;
BEGIN
 IF NOT ab.investor_registry_owner()THEN RAISE EXCEPTION 'monthly_owner_only' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE'THEN RAISE EXCEPTION 'monthly_history_retained' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='investor_monthly_lines'AND TG_OP='UPDATE'THEN
  IF to_jsonb(NEW)-'released' IS DISTINCT FROM to_jsonb(OLD)-'released' OR OLD.released OR NOT NEW.released OR NOT EXISTS(SELECT 1 FROM ab.investor_monthly_settlements s WHERE s.tenant_id=OLD.tenant_id AND s.id=OLD.settlement_id AND s.status='Cancelled')THEN RAISE EXCEPTION 'monthly_line_immutable' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME<>'investor_monthly_settlements' OR TG_OP<>'UPDATE'THEN RAISE EXCEPTION 'monthly_history_immutable' USING ERRCODE='42501';END IF;
 IF to_jsonb(NEW)-ARRAY['status','revision','voucher_id'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','revision','voucher_id'] OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'monthly_snapshot_immutable' USING ERRCODE='42501';END IF;
 IF OLD.status='Paid'OR OLD.status='Cancelled'OR NOT((OLD.status='Draft'AND NEW.status IN('Reviewed','Cancelled'))OR(OLD.status='Reviewed'AND NEW.status IN('Approved','Cancelled'))OR(OLD.status='Approved'AND NEW.status IN('Paid','Cancelled')))THEN RAISE EXCEPTION 'monthly_invalid_transition' USING ERRCODE='42501';END IF;
 IF OLD.voucher_id IS NOT NULL AND NEW.voucher_id IS DISTINCT FROM OLD.voucher_id THEN RAISE EXCEPTION 'monthly_voucher_immutable' USING ERRCODE='42501';END IF;
 SELECT coalesce(sum(l.amount),0)INTO total FROM ab.investor_monthly_lines l WHERE l.tenant_id=OLD.tenant_id AND l.settlement_id=OLD.id AND NOT l.released;
 IF total<>OLD.amount THEN RAISE EXCEPTION 'monthly_line_total_mismatch' USING ERRCODE='23514';END IF;
 IF NEW.voucher_id IS NOT NULL THEN SELECT * INTO v FROM ab.finance_vouchers WHERE tenant_id=NEW.tenant_id AND id=NEW.voucher_id;IF v.company_id<>NEW.company_id OR v.currency<>NEW.currency OR v.amount<>NEW.amount THEN RAISE EXCEPTION 'monthly_voucher_mismatch' USING ERRCODE='23514';END IF;END IF;
 IF NEW.status='Approved'AND NEW.voucher_id IS NULL THEN RAISE EXCEPTION 'monthly_voucher_required' USING ERRCODE='23514';END IF;
 IF NEW.status='Cancelled'AND OLD.voucher_id IS NOT NULL AND v.status<>'Cancelled'THEN RAISE EXCEPTION 'monthly_cancel_voucher_first' USING ERRCODE='23514';END IF;
 IF NEW.status='Paid'THEN
  SELECT EXISTS(SELECT 1 FROM ab.finance_entries e JOIN ab.finance_operations o ON o.id=e.operation_id AND o.tenant_id=e.tenant_id JOIN ab.finance_statement_lines sl ON sl.entry_id=e.id AND sl.tenant_id=e.tenant_id JOIN ab.finance_statements st ON st.id=sl.statement_id AND st.tenant_id=sl.tenant_id WHERE e.tenant_id=NEW.tenant_id AND e.operation_id=v.operation_id AND e.company_id=NEW.company_id AND e.bank_account_id=v.bank_account_id AND e.currency=NEW.currency AND e.credit=NEW.amount AND e.debit=0 AND o.status='Approved'AND o.kind='payment'AND o.effective_on<=(now()AT TIME ZONE 'Asia/Dubai')::date AND sl.effective_on=o.effective_on AND st.status='Approved'AND st.bank_account_id=e.bank_account_id AND sl.amount=-e.credit)INTO matched;
  IF v.status<>'Paid'OR NOT matched THEN RAISE EXCEPTION 'monthly_bank_debit_not_confirmed' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END$$;
CREATE FUNCTION ab.investor_monthly_line_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE a record;e record;parent record;used numeric;trace numeric;
BEGIN
 IF NOT ab.investor_registry_owner()OR NEW.tenant_id<>ab.tenant()OR NEW.created_by<>nullif(current_setting('ab.actor',true),'')::uuid OR NEW.released THEN RAISE EXCEPTION 'monthly_line_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO parent FROM ab.investor_monthly_settlements WHERE id=NEW.settlement_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 IF parent.status<>'Draft'THEN RAISE EXCEPTION 'monthly_draft_required' USING ERRCODE='23514';END IF;
 SELECT x.*,i.kind invoice_kind,v.request_id,f.id funding_id,fv.version_id,g.investor_id INTO a FROM ab.vehicle_allocations x JOIN ab.vehicle_invoices i ON i.id=x.invoice_id AND i.tenant_id=x.tenant_id JOIN ab.vehicles v ON v.id=i.vehicle_id AND v.tenant_id=i.tenant_id JOIN ab.investor_funding_requests f ON f.request_id=v.request_id AND f.tenant_id=v.tenant_id JOIN ab.investor_funding_versions fv ON fv.funding_id=f.id AND fv.tenant_id=f.tenant_id JOIN ab.investor_agreements g ON g.id=f.agreement_id AND g.tenant_id=f.tenant_id WHERE x.id=NEW.allocation_id AND x.tenant_id=NEW.tenant_id FOR UPDATE OF x;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM ab.investor_monthly_versions mv WHERE mv.tenant_id=NEW.tenant_id AND mv.version_id=NEW.version_id AND mv.company_id=NEW.company_id AND mv.investor_id=NEW.investor_id AND mv.configuration_id=parent.configuration_id)OR a.company_id<>NEW.company_id OR a.receipt_id<>NEW.receipt_id OR a.funding_id<>NEW.funding_id OR a.version_id<>NEW.version_id OR a.investor_id<>NEW.investor_id OR NEW.source_amount>a.amount OR(NEW.kind='installment'AND a.invoice_kind<>'finance')OR(NEW.kind='registration_share'AND(a.invoice_kind<>'admin'OR NOT EXISTS(SELECT 1 FROM ab.investor_registration_sources src WHERE src.tenant_id=NEW.tenant_id AND src.funding_id=NEW.funding_id AND src.invoice_id=a.invoice_id)))OR EXISTS(SELECT 1 FROM ab.finance_allocation_reversals r WHERE r.tenant_id=NEW.tenant_id AND r.allocation_id=NEW.allocation_id)THEN RAISE EXCEPTION 'monthly_source_mismatch' USING ERRCODE='23514';END IF;
 SELECT * INTO e FROM ab.finance_entries WHERE tenant_id=NEW.tenant_id AND id=NEW.bank_entry_id FOR UPDATE;
 IF NOT FOUND OR e.company_id<>NEW.company_id OR e.currency<>parent.currency OR e.bank_account_id IS NULL OR e.debit<=0 OR NOT EXISTS(SELECT 1 FROM ab.finance_operations o JOIN ab.finance_statement_lines sl ON sl.entry_id=e.id AND sl.tenant_id=o.tenant_id JOIN ab.finance_statements st ON st.id=sl.statement_id AND st.tenant_id=sl.tenant_id WHERE o.id=e.operation_id AND o.tenant_id=NEW.tenant_id AND o.company_id=NEW.company_id AND o.kind='receipt'AND o.status='Approved'AND o.effective_on<=least((now()AT TIME ZONE 'Asia/Dubai')::date,((parent.period||'-01')::date+interval '1 month'-interval '1 day')::date)AND sl.effective_on=o.effective_on AND st.status='Approved'AND EXISTS(SELECT 1 FROM ab.finance_events fe WHERE fe.tenant_id=NEW.tenant_id AND fe.entity_id=st.id AND((fe.entity_type='finance_statement'AND fe.action='approved')OR(fe.entity_type='ledger'AND fe.action='bank_reconciliation_approved'))AND(fe.created_at AT TIME ZONE 'Asia/Dubai')::date<=((parent.period||'-01')::date+interval '1 month'-interval '1 day')::date)AND st.bank_account_id=e.bank_account_id AND sl.amount=e.debit)THEN RAISE EXCEPTION 'monthly_bank_credit_not_confirmed' USING ERRCODE='23514';END IF;
 SELECT CASE WHEN r.kind='cash'THEN(SELECT sum(-cm.amount)FROM ab.finance_custody_moves cm JOIN ab.finance_deposits dep ON cm.source_key='deposit:'||dep.id::text||':out:'||r.id::text AND dep.tenant_id=cm.tenant_id WHERE cm.tenant_id=r.tenant_id AND cm.receipt_id=r.id AND cm.amount<0 AND dep.operation_id=e.operation_id AND dep.status='Confirmed')WHEN r.kind='transfer'AND b.operation_id=e.operation_id THEN r.amount WHEN r.kind='cheque'AND r.deposit_operation_id=e.operation_id THEN r.amount ELSE 0 END INTO trace FROM ab.finance_receipts r LEFT JOIN ab.finance_receipt_batches b ON b.id=r.batch_id AND b.tenant_id=r.tenant_id WHERE r.id=NEW.receipt_id AND r.tenant_id=NEW.tenant_id AND r.payment_state='Cleared';
 IF trace IS NULL OR trace<=0 OR NEW.source_amount>trace THEN RAISE EXCEPTION 'monthly_bank_receipt_trace_invalid' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(source_amount),0)INTO used FROM ab.investor_monthly_lines WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.receipt_id AND bank_entry_id=e.id AND NOT released;
 IF used+NEW.source_amount>trace THEN RAISE EXCEPTION 'monthly_receipt_credit_overclaimed' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(amount),0)INTO used FROM ab.investor_monthly_lines WHERE tenant_id=NEW.tenant_id AND bank_entry_id=e.id AND NOT released;
 IF used+NEW.amount>e.debit THEN RAISE EXCEPTION 'monthly_bank_credit_overclaimed' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE FUNCTION ab.investor_monthly_reversal_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$BEGIN
 IF EXISTS(SELECT 1 FROM ab.vehicle_allocations original JOIN ab.vehicle_invoices i ON i.id=original.invoice_id AND i.tenant_id=original.tenant_id JOIN ab.investor_monthly_invoice_classifications ic ON ic.invoice_id=i.id AND ic.tenant_id=i.tenant_id JOIN ab.finance_receipts oldr ON oldr.id=original.receipt_id AND oldr.tenant_id=original.tenant_id JOIN ab.vehicle_allocations later ON later.invoice_id=i.id AND later.tenant_id=i.tenant_id JOIN ab.finance_receipts newr ON newr.id=later.receipt_id AND newr.tenant_id=later.tenant_id WHERE original.id=NEW.allocation_id AND original.tenant_id=NEW.tenant_id AND i.kind='admin'AND newr.receipt_number>oldr.receipt_number AND NOT EXISTS(SELECT 1 FROM ab.finance_allocation_reversals rev WHERE rev.allocation_id=later.id AND rev.tenant_id=later.tenant_id))THEN RAISE EXCEPTION 'monthly_ordered_registration_correction_required' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM ab.investor_monthly_lines l WHERE l.tenant_id=NEW.tenant_id AND NOT l.released AND EXISTS(SELECT 1 FROM ab.vehicle_allocations original JOIN ab.vehicle_allocations claimed ON claimed.invoice_id=original.invoice_id AND claimed.tenant_id=original.tenant_id WHERE original.id=NEW.allocation_id AND original.tenant_id=NEW.tenant_id AND claimed.id=l.allocation_id))THEN RAISE EXCEPTION 'monthly_claim_requires_documented_correction' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE FUNCTION ab.investor_monthly_bank_source_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE referenced boolean;
BEGIN
 IF TG_TABLE_NAME='finance_receipts'THEN
  IF(OLD.payment_state,OLD.deposit_operation_id)IS NOT DISTINCT FROM(NEW.payment_state,NEW.deposit_operation_id)THEN RETURN NEW;END IF;
  SELECT EXISTS(SELECT 1 FROM ab.investor_monthly_lines l WHERE l.tenant_id=OLD.tenant_id AND l.receipt_id=OLD.id AND NOT l.released)INTO referenced;
 ELSIF TG_TABLE_NAME='finance_statement_lines'THEN
  IF NOT EXISTS(SELECT 1 FROM ab.finance_statements st WHERE st.id=OLD.statement_id AND st.tenant_id=OLD.tenant_id AND st.status='Approved')THEN IF TG_OP='DELETE'THEN RETURN OLD;END IF;RETURN NEW;END IF;
  IF TG_OP='UPDATE'AND to_jsonb(OLD)=to_jsonb(NEW)THEN RETURN NEW;END IF;
  SELECT EXISTS(SELECT 1 FROM ab.investor_monthly_lines l WHERE l.tenant_id=OLD.tenant_id AND l.bank_entry_id=OLD.entry_id AND NOT l.released)OR EXISTS(SELECT 1 FROM ab.investor_monthly_settlements ms JOIN ab.finance_vouchers v ON v.id=ms.voucher_id AND v.tenant_id=ms.tenant_id JOIN ab.finance_entries e ON e.operation_id=v.operation_id AND e.tenant_id=v.tenant_id WHERE ms.tenant_id=OLD.tenant_id AND ms.status<>'Cancelled'AND e.id=OLD.entry_id)INTO referenced;
 ELSE
  IF OLD.status<>'Approved'THEN IF TG_OP='DELETE'THEN RETURN OLD;END IF;RETURN NEW;END IF;
  IF TG_OP='UPDATE'AND to_jsonb(OLD)=to_jsonb(NEW)THEN RETURN NEW;END IF;
  SELECT EXISTS(SELECT 1 FROM ab.finance_statement_lines sl JOIN ab.investor_monthly_lines l ON l.bank_entry_id=sl.entry_id AND l.tenant_id=sl.tenant_id WHERE sl.statement_id=OLD.id AND sl.tenant_id=OLD.tenant_id AND NOT l.released)OR EXISTS(SELECT 1 FROM ab.finance_statement_lines sl JOIN ab.finance_entries e ON e.id=sl.entry_id AND e.tenant_id=sl.tenant_id JOIN ab.finance_vouchers v ON v.operation_id=e.operation_id AND v.tenant_id=e.tenant_id JOIN ab.investor_monthly_settlements ms ON ms.voucher_id=v.id AND ms.tenant_id=v.tenant_id WHERE sl.statement_id=OLD.id AND sl.tenant_id=OLD.tenant_id AND ms.status<>'Cancelled')INTO referenced;
 END IF;
 IF referenced THEN RAISE EXCEPTION 'monthly_bank_source_requires_documented_correction' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE'THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_monthly_statement_source BEFORE UPDATE OR DELETE ON ab.finance_statements FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_bank_source_guard();
CREATE TRIGGER investor_monthly_statement_line_source BEFORE UPDATE OR DELETE ON ab.finance_statement_lines FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_bank_source_guard();
CREATE TRIGGER investor_monthly_receipt_source BEFORE UPDATE ON ab.finance_receipts FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_bank_source_guard();
-- Additional narrowly scoped trigger; it does not replace any existing financial guard or touch old rows.
CREATE TRIGGER investor_monthly_claim_reversal BEFORE INSERT ON ab.finance_allocation_reversals FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_reversal_guard();
CREATE TRIGGER investor_monthly_line_source BEFORE INSERT ON ab.investor_monthly_lines FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_line_guard();
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['investor_monthly_configurations','investor_monthly_versions','investor_monthly_invoice_classifications','investor_monthly_settlements','investor_monthly_lines','investor_monthly_exclusions']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE ab.%I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY monthly_owner_read ON ab.%I FOR SELECT USING(tenant_id=ab.tenant()AND ab.investor_registry_owner())',tab);
 EXECUTE format('CREATE POLICY monthly_owner_insert ON ab.%I FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting(''ab.actor'',true),'''')::uuid AND ab.investor_registry_owner())',tab);
 IF tab<>'investor_monthly_lines'THEN EXECUTE format('CREATE TRIGGER monthly_initial_guard BEFORE INSERT ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_insert_guard()',tab);END IF;
 EXECUTE format('CREATE TRIGGER monthly_history_guard BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.investor_monthly_guard()',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
END LOOP;END$$;
CREATE POLICY monthly_owner_update ON ab.investor_monthly_settlements FOR UPDATE USING(tenant_id=ab.tenant()AND ab.investor_registry_owner())WITH CHECK(tenant_id=ab.tenant()AND ab.investor_registry_owner());
CREATE POLICY monthly_owner_release ON ab.investor_monthly_lines FOR UPDATE USING(tenant_id=ab.tenant()AND ab.investor_registry_owner())WITH CHECK(tenant_id=ab.tenant()AND ab.investor_registry_owner());
GRANT UPDATE(status,revision,voucher_id)ON ab.investor_monthly_settlements TO ab_runtime;
GRANT UPDATE(released)ON ab.investor_monthly_lines TO ab_runtime;
REVOKE ALL ON FUNCTION ab.investor_monthly_bank_source_guard(),ab.investor_monthly_insert_guard(),ab.investor_monthly_guard(),ab.investor_monthly_line_guard(),ab.investor_monthly_reversal_guard()FROM PUBLIC;
CREATE FUNCTION ab.investor_monthly_existing_right(co uuid,actions text[])RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT ab.hr_actor_allowed()AND EXISTS(SELECT 1 FROM ab.users u JOIN ab.roles r ON r.id=u.role_id WHERE u.tenant_id=ab.tenant()AND u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.status='Active'AND(u.role_id='owner'OR(EXISTS(SELECT 1 FROM unnest(actions) a WHERE(r.data->'permissions')?a)AND EXISTS(SELECT 1 FROM ab.user_companies m WHERE m.tenant_id=u.tenant_id AND m.user_id=u.id AND m.company_id=co AND m.active))OR EXISTS(SELECT 1 FROM ab.permission_grants g JOIN ab.users issuer ON issuer.id=g.issuer_id AND issuer.tenant_id=g.tenant_id WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL AND issuer.status='Active'AND g.permission_id=ANY(actions)AND(g.scope_type='group'OR(g.scope_type='company'AND g.company_id=co)))))
$$;
CREATE POLICY monthly_classification_scoped_read ON ab.investor_monthly_invoice_classifications FOR SELECT USING(tenant_id=ab.tenant()AND ab.investor_monthly_existing_right(company_id,ARRAY['ledger_collect','ledger_invoice_create','ledger_invoice_correct','ledger_journal_approve','ledger_view','ledger_close','ledger_report']));
CREATE FUNCTION ab.investor_monthly_invoice_context(target uuid,mark_classified boolean DEFAULT false)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE result jsonb;co uuid;version uuid;funded boolean;
BEGIN
 SELECT jsonb_build_object('row',jsonb_build_object('id',f.id,'agreement_id',f.agreement_id,'company_id',f.company_id,'investor_id',s.investor_id,'kind',i.kind,'invoice_amount',i.amount::text,'invoice_currency',i.currency,'invoice_company',i.company_id,'vehicle_id',i.vehicle_id,'registration_source',EXISTS(SELECT 1 FROM ab.investor_registration_sources src WHERE src.tenant_id=i.tenant_id AND src.funding_id=f.id AND src.invoice_id=i.id)),'classified',EXISTS(SELECT 1 FROM ab.investor_monthly_invoice_classifications ic WHERE ic.tenant_id=i.tenant_id AND ic.invoice_id=i.id),'terms_cipher',f.terms_cipher,'cfg',to_jsonb(cfg)) ,i.company_id,mv.version_id INTO result,co,version
 FROM ab.vehicle_invoices i JOIN ab.vehicles v ON v.id=i.vehicle_id AND v.tenant_id=i.tenant_id JOIN ab.investor_funding_requests f ON f.request_id=v.request_id AND f.tenant_id=v.tenant_id JOIN ab.investor_funding_versions fv ON fv.funding_id=f.id AND fv.tenant_id=f.tenant_id JOIN ab.investor_monthly_versions mv ON mv.version_id=fv.version_id AND mv.tenant_id=fv.tenant_id JOIN ab.investor_agreement_series s ON s.investor_id=mv.investor_id AND s.agreement_id=f.agreement_id AND s.tenant_id=f.tenant_id JOIN ab.investor_monthly_configurations cfg ON cfg.id=mv.configuration_id AND cfg.tenant_id=mv.tenant_id WHERE i.id=target AND i.tenant_id=ab.tenant();
 IF result IS NULL THEN RETURN NULL;END IF;
 IF NOT ab.investor_monthly_existing_right(co,ARRAY['ledger_collect','ledger_invoice_create','ledger_invoice_correct','ledger_journal_approve'])THEN RAISE EXCEPTION 'monthly_financial_scope_denied' USING ERRCODE='42501';END IF;
 SELECT EXISTS(SELECT 1 FROM ab.investor_funding_requests f JOIN ab.vehicle_funds vf ON vf.request_id=f.request_id AND vf.tenant_id=f.tenant_id JOIN ab.finance_operations op ON op.id=vf.payment_operation_id AND op.tenant_id=vf.tenant_id WHERE f.id=(result->'row'->>'id')::uuid AND f.tenant_id=ab.tenant()AND op.kind='payment'AND op.status='Approved'AND op.company_id=co AND op.currency=(result->'cfg'->>'currency')AND op.counterpart_id=(result->'cfg'->>'capital_chart_id')::uuid AND op.amount=f.amount)INTO funded;
 IF NOT funded THEN RAISE EXCEPTION 'monthly_capital_disbursement_not_confirmed' USING ERRCODE='23514';END IF;
 IF mark_classified THEN
  IF NOT ab.investor_monthly_existing_right(co,ARRAY['ledger_invoice_create'])OR NOT ab.investor_monthly_existing_right(co,ARRAY['ledger_journal_approve'])THEN RAISE EXCEPTION 'monthly_invoice_classification_denied' USING ERRCODE='42501';END IF;
  INSERT INTO ab.investor_monthly_invoice_classifications(id,tenant_id,company_id,invoice_id,version_id,created_by)VALUES(gen_random_uuid(),ab.tenant(),co,target,version,nullif(current_setting('ab.actor',true),'')::uuid);
 END IF;RETURN result;
END$$;
REVOKE ALL ON FUNCTION ab.investor_monthly_existing_right(uuid,text[]),ab.investor_monthly_invoice_context(uuid,boolean)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_monthly_existing_right(uuid,text[]),ab.investor_monthly_invoice_context(uuid,boolean)TO ab_runtime;
CREATE FUNCTION ab.investor_monthly_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'INVESTOR-MONTHLY-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.investor_monthly_schema_version()FROM PUBLIC;GRANT EXECUTE ON FUNCTION ab.investor_monthly_schema_version()TO ab_runtime;
