-- PROPOSAL ONLY. Not in the approved catalog; never applied by ordinary delivery.
-- Adds operational billing metadata; existing invoices, receipts, ledgers and grants are untouched.
CREATE FUNCTION ab.operating_billing_right(co uuid,action text)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users u WHERE u.tenant_id=ab.tenant()AND u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.status='Active'AND(u.role_id='owner'OR EXISTS(SELECT 1 FROM ab.permission_grants g WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL AND g.permission_id=action AND(g.scope_type='group'OR(g.scope_type='company'AND g.company_id=co)))))
$$;
CREATE FUNCTION ab.operating_billing_scope(co uuid)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$ SELECT ab.operating_billing_right(co,'ledger_view') $$;
REVOKE ALL ON FUNCTION ab.operating_billing_right(uuid,text),ab.operating_billing_scope(uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.operating_billing_right(uuid,text),ab.operating_billing_scope(uuid)TO ab_runtime;
CREATE TABLE ab.operating_bill_lines(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,contract_id uuid NOT NULL,contracting_company_id uuid NOT NULL,
 line_key text NOT NULL CHECK(length(line_key)<=200),revision integer NOT NULL CHECK(revision>0),
 period_on date NOT NULL,due_on date NOT NULL,item_id uuid NOT NULL,amount numeric(18,3)NOT NULL CHECK(amount>0),currency text NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 state text NOT NULL DEFAULT 'Ready'CHECK(state IN('Ready','Invoiced','Cancelled')),invoice_id uuid,payload_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),
 CHECK((state='Invoiced')=(invoice_id IS NOT NULL)),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,item_id)REFERENCES ab.finance_items(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX operating_bill_once ON ab.operating_bill_lines(tenant_id,contract_id,line_key)WHERE state<>'Cancelled';
CREATE INDEX operating_bill_due ON ab.operating_bill_lines(tenant_id,company_id,due_on)WHERE state='Ready';
CREATE TABLE ab.operating_statements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,source_hash text NOT NULL CHECK(length(source_hash)=64),
 scan_status text NOT NULL CHECK(scan_status='clean'),payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),UNIQUE(tenant_id,company_id,source_hash),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.operating_charges(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,statement_id uuid,movement_key text NOT NULL CHECK(length(movement_key)=64),
 vehicle_id uuid,contract_id uuid,customer_id uuid,contracting_company_id uuid,
 occurred_at timestamptz,kind text NOT NULL CHECK(kind IN('salik','parking','fine','fuel','other')),cost numeric(18,3)NOT NULL CHECK(cost>=0),bill_amount numeric(18,3)NOT NULL CHECK(bill_amount>=0),currency text NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 borne_by text CHECK(borne_by IN('customer','group','other')),state text NOT NULL DEFAULT 'NeedsReview'CHECK(state IN('NeedsReview','Approved','Invoiced','ExpenseRequested','ThirdParty')),
 invoice_id uuid,voucher_id uuid,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),UNIQUE(tenant_id,company_id,movement_key),
 CHECK(num_nonnulls(customer_id,contracting_company_id)<=1),CHECK((state='Invoiced')=(invoice_id IS NOT NULL)),CHECK((state='ExpenseRequested')=(voucher_id IS NOT NULL)),
 CHECK(state='NeedsReview'OR(borne_by IS NOT NULL AND vehicle_id IS NOT NULL AND occurred_at IS NOT NULL)),
 CHECK(state NOT IN('Approved','Invoiced')OR(borne_by='customer'AND num_nonnulls(customer_id,contracting_company_id)=1)),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,statement_id)REFERENCES ab.operating_statements(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,vehicle_id)REFERENCES ab.vehicles(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,customer_id)REFERENCES ab.customers(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,voucher_id)REFERENCES ab.finance_vouchers(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE INDEX operating_charge_review ON ab.operating_charges(tenant_id,company_id,state,occurred_at);
CREATE FUNCTION ab.operating_line_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.state<>'Ready'OR(NEW.id,NEW.tenant_id,NEW.company_id,NEW.contract_id,NEW.contracting_company_id,NEW.line_key,NEW.revision,NEW.period_on,NEW.due_on,NEW.item_id,NEW.amount,NEW.currency,NEW.payload_cipher,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.contract_id,OLD.contracting_company_id,OLD.line_key,OLD.revision,OLD.period_on,OLD.due_on,OLD.item_id,OLD.amount,OLD.currency,OLD.payload_cipher,OLD.created_by,OLD.created_at)OR NEW.state NOT IN('Cancelled','Invoiced')THEN RAISE EXCEPTION 'immutable billing snapshot' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
CREATE TRIGGER operating_line_guard BEFORE UPDATE ON ab.operating_bill_lines FOR EACH ROW EXECUTE FUNCTION ab.operating_line_guard();
CREATE FUNCTION ab.operating_charge_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.statement_id,NEW.movement_key,NEW.kind,NEW.cost,NEW.currency,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.statement_id,OLD.movement_key,OLD.kind,OLD.cost,OLD.currency,OLD.created_by,OLD.created_at)OR OLD.state IN('Invoiced','ExpenseRequested','ThirdParty')OR(OLD.state='Approved'AND(NEW.state<>'Invoiced'OR(NEW.vehicle_id,NEW.contract_id,NEW.customer_id,NEW.contracting_company_id,NEW.occurred_at,NEW.bill_amount,NEW.borne_by,NEW.payload_cipher)IS DISTINCT FROM(OLD.vehicle_id,OLD.contract_id,OLD.customer_id,OLD.contracting_company_id,OLD.occurred_at,OLD.bill_amount,OLD.borne_by,OLD.payload_cipher)))OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'immutable approved charge' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
CREATE TRIGGER operating_charge_guard BEFORE UPDATE ON ab.operating_charges FOR EACH ROW EXECUTE FUNCTION ab.operating_charge_guard();
CREATE TRIGGER operating_statement_immutable BEFORE UPDATE OR DELETE ON ab.operating_statements FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE TRIGGER operating_line_no_delete BEFORE DELETE ON ab.operating_bill_lines FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE TRIGGER operating_charge_no_delete BEFORE DELETE ON ab.operating_charges FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['operating_bill_lines','operating_statements','operating_charges']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant())',t);
 EXECUTE format('CREATE POLICY company_scope ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.operating_billing_scope(company_id))WITH CHECK(ab.operating_billing_scope(company_id))',t);
 EXECUTE format('CREATE POLICY active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON ab.%I TO ab_runtime',t);
END LOOP;END$$;
REVOKE UPDATE ON ab.operating_statements FROM ab_runtime;
REVOKE ALL ON FUNCTION ab.operating_line_guard(),ab.operating_charge_guard()FROM PUBLIC;
-- No INSERT/UPDATE of any pre-existing business data, role, grant, balance, invoice or agreement.

CREATE FUNCTION ab.operating_new_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_TABLE_NAME='operating_bill_lines'THEN IF(NEW.state<>'Ready'OR NEW.invoice_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM ab.users WHERE id=nullif(current_setting('ab.actor',true),'')::uuid AND tenant_id=ab.tenant()AND role_id='owner'AND status='Active'))THEN RAISE EXCEPTION 'owner approved schedule required' USING ERRCODE='23514';END IF;END IF;
 IF TG_TABLE_NAME='operating_charges'THEN IF(NEW.state<>'NeedsReview'OR NEW.invoice_id IS NOT NULL OR NEW.voucher_id IS NOT NULL OR NEW.borne_by IS NOT NULL OR NEW.bill_amount<>0)THEN RAISE EXCEPTION 'charge review required' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END$$;
CREATE TRIGGER operating_line_insert BEFORE INSERT ON ab.operating_bill_lines FOR EACH ROW EXECUTE FUNCTION ab.operating_new_guard();
CREATE TRIGGER operating_charge_insert BEFORE INSERT ON ab.operating_charges FOR EACH ROW EXECUTE FUNCTION ab.operating_new_guard();
CREATE FUNCTION ab.operating_charge_relations()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.state<>OLD.state AND OLD.state='NeedsReview'AND NOT EXISTS(SELECT 1 FROM ab.users WHERE id=nullif(current_setting('ab.actor',true),'')::uuid AND tenant_id=ab.tenant()AND role_id='owner'AND status='Active')THEN RAISE EXCEPTION 'owner review required' USING ERRCODE='23514';END IF;
 IF NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.vehicles v JOIN ab.customers c ON c.id=v.customer_id AND c.tenant_id=v.tenant_id WHERE v.id=NEW.vehicle_id AND v.tenant_id=NEW.tenant_id AND v.company_id=NEW.company_id AND c.id=NEW.customer_id)THEN RAISE EXCEPTION 'charge customer mismatch' USING ERRCODE='23514';END IF;
 IF NEW.contract_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.marketing_contracts c JOIN ab.marketing_allocations a ON a.contract_id=c.id AND a.tenant_id=c.tenant_id WHERE c.id=NEW.contract_id AND c.tenant_id=NEW.tenant_id AND c.company_id=NEW.company_id AND c.contracting_company_id=NEW.contracting_company_id AND a.vehicle_id=NEW.vehicle_id AND NEW.occurred_at>=a.starts_at AND NEW.occurred_at<a.ends_at)THEN RAISE EXCEPTION 'charge contract mismatch' USING ERRCODE='23514';END IF;
 IF NEW.invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.vehicle_invoices i WHERE i.id=NEW.invoice_id AND i.tenant_id=NEW.tenant_id AND i.company_id=NEW.company_id AND i.currency=NEW.currency AND i.customer_id IS NOT DISTINCT FROM NEW.customer_id AND i.contracting_company_id IS NOT DISTINCT FROM NEW.contracting_company_id)THEN RAISE EXCEPTION 'charge invoice mismatch' USING ERRCODE='23514';END IF;
 IF NEW.voucher_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.finance_vouchers v WHERE v.id=NEW.voucher_id AND v.tenant_id=NEW.tenant_id AND v.company_id=NEW.company_id AND v.currency=NEW.currency AND v.amount=NEW.cost)THEN RAISE EXCEPTION 'charge voucher mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER operating_charge_relations BEFORE UPDATE ON ab.operating_charges FOR EACH ROW EXECUTE FUNCTION ab.operating_charge_relations();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['operating_bill_lines','operating_statements','operating_charges']LOOP
 EXECUTE format('CREATE POLICY invoice_writer ON ab.%I AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(ab.operating_billing_right(company_id,''ledger_invoice_create''))',t);
 EXECUTE format('CREATE POLICY invoice_updater ON ab.%I AS RESTRICTIVE FOR UPDATE TO ab_runtime USING(ab.operating_billing_right(company_id,''ledger_invoice_create''))WITH CHECK(ab.operating_billing_right(company_id,''ledger_invoice_create''))',t);
END LOOP;END$$;
REVOKE ALL ON FUNCTION ab.operating_new_guard(),ab.operating_charge_relations()FROM PUBLIC;
