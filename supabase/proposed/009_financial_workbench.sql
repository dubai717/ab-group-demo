-- PROPOSED ONLY. Apply to isolated synthetic tests explicitly; NOT approved for Supabase.
-- No existing row/role/catalog grant is rewritten. Existing eight migrations stay immutable.
INSERT INTO ab.permissions(id) SELECT unnest(ARRAY['finance_view','finance_create','finance_approve','finance_cheques','finance_custody','finance_receive_custody','finance_reconcile','finance_chart','finance_notifications','finance_print','finance_export','finance_sensitive']) ON CONFLICT DO NOTHING;
ALTER TABLE ab.bank_accounts ADD CONSTRAINT finance_bank_company_unique UNIQUE(tenant_id,company_id,id);
CREATE TABLE ab.finance_chart(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,code text NOT NULL,name_ar text NOT NULL,name_en text NOT NULL,
 kind text NOT NULL CHECK(kind IN('bank','asset','liability','income','expense','equity')),bank_account_id uuid,currency char(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,code),UNIQUE(tenant_id,company_id,id),UNIQUE(tenant_id,bank_account_id),
 CHECK((kind='bank')=(bank_account_id IS NOT NULL)),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_cheques(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,bank_account_id uuid NOT NULL,direction text NOT NULL CHECK(direction IN('incoming','outgoing')),
 number text NOT NULL,beneficiary text NOT NULL,amount numeric(21,3) NOT NULL CHECK(amount>0),currency char(3) NOT NULL,issued_on date NOT NULL,due_on date NOT NULL CHECK(due_on>=issued_on),
 status text NOT NULL CHECK(status IN('Received','Issued','Delivered','Deposited','Clearing','Collected','Returned','Cancelled')),integration_refs jsonb NOT NULL DEFAULT '{}',
 document_version_id uuid,revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,bank_account_id,direction,number),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id) REFERENCES ab.document_versions(tenant_id,id));
CREATE TABLE ab.finance_operations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('receipt','payment','transfer','adjustment','fee','tax')),
 bank_account_id uuid NOT NULL,to_bank_account_id uuid,amount numeric(21,3) NOT NULL CHECK(amount>0),currency char(3) NOT NULL,effective_on date NOT NULL,direction text NOT NULL CHECK(direction IN('credit','debit')),
 beneficiary text NOT NULL DEFAULT '',payment_method text NOT NULL DEFAULT 'electronic' CHECK(payment_method IN('electronic','cheque')),
 reason text NOT NULL CHECK(length(btrim(reason))>0),reference text NOT NULL CHECK(length(btrim(reference))>0),counterpart_id uuid,intercompany_from_id uuid,intercompany_to_id uuid,
 document_version_id uuid,cheque_id uuid,integration_refs jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'Draft' CHECK(status IN('Draft','Approved','Rejected')),
 revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,approved_by uuid,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='transfer')=(to_bank_account_id IS NOT NULL)),CHECK(to_bank_account_id IS NULL OR to_bank_account_id<>bank_account_id),CHECK((status='Approved')=(approved_by IS NOT NULL AND approved_at IS NOT NULL)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,reference),UNIQUE(tenant_id,cheque_id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,to_bank_account_id) REFERENCES ab.bank_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,counterpart_id) REFERENCES ab.finance_chart(tenant_id,id),FOREIGN KEY(tenant_id,intercompany_from_id) REFERENCES ab.finance_chart(tenant_id,id),FOREIGN KEY(tenant_id,intercompany_to_id) REFERENCES ab.finance_chart(tenant_id,id),
 FOREIGN KEY(tenant_id,document_version_id) REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,cheque_id) REFERENCES ab.finance_cheques(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_entries(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,operation_id uuid NOT NULL,company_id uuid NOT NULL,chart_id uuid NOT NULL,bank_account_id uuid,
 debit numeric(21,3) NOT NULL DEFAULT 0 CHECK(debit>=0),credit numeric(21,3) NOT NULL DEFAULT 0 CHECK(credit>=0),currency char(3) NOT NULL,
 CHECK((debit>0)<>(credit>0)),UNIQUE(tenant_id,id),UNIQUE(tenant_id,operation_id,chart_id),FOREIGN KEY(tenant_id,operation_id) REFERENCES ab.finance_operations(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,chart_id) REFERENCES ab.finance_chart(tenant_id,company_id,id),FOREIGN KEY(tenant_id,company_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,company_id,id));
CREATE TABLE ab.finance_receipts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,holder_id uuid NOT NULL,amount numeric(21,3) NOT NULL CHECK(amount>0),currency char(3) NOT NULL,kind text NOT NULL CHECK(kind IN('cash','cheque')),
 cheque_id uuid,reference text NOT NULL,integration_refs jsonb NOT NULL DEFAULT '{}',deposit_operation_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='cheque')=(cheque_id IS NOT NULL)),UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,reference),UNIQUE(tenant_id,cheque_id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,holder_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,cheque_id) REFERENCES ab.finance_cheques(tenant_id,id),FOREIGN KEY(tenant_id,deposit_operation_id) REFERENCES ab.finance_operations(tenant_id,id));
CREATE TABLE ab.finance_handovers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,sender_id uuid NOT NULL,receiver_id uuid NOT NULL,status text NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Accepted','Rejected')),
 reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),received_at timestamptz,CHECK(sender_id<>receiver_id),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,sender_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,receiver_id) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_handover_items(tenant_id uuid NOT NULL,handover_id uuid NOT NULL,receipt_id uuid NOT NULL,PRIMARY KEY(tenant_id,handover_id,receipt_id),FOREIGN KEY(tenant_id,handover_id) REFERENCES ab.finance_handovers(tenant_id,id),FOREIGN KEY(tenant_id,receipt_id) REFERENCES ab.finance_receipts(tenant_id,id));
CREATE TABLE ab.finance_statements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,bank_account_id uuid NOT NULL,period_from date NOT NULL,period_to date NOT NULL CHECK(period_to>=period_from),
 opening_balance numeric(21,3) NOT NULL,closing_balance numeric(21,3) NOT NULL,source_hash text NOT NULL,document_version_id uuid,status text NOT NULL DEFAULT 'Review' CHECK(status IN('Review','Approved')),
 created_by uuid NOT NULL,approved_by uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,bank_account_id,source_hash),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,company_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,company_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id) REFERENCES ab.document_versions(tenant_id,id));
CREATE TABLE ab.finance_statement_lines(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,statement_id uuid NOT NULL,line_no integer NOT NULL CHECK(line_no>0),effective_on date NOT NULL,amount numeric(21,3) NOT NULL CHECK(amount<>0),reference text NOT NULL,
 entry_id uuid,explanation text NOT NULL DEFAULT '',UNIQUE(tenant_id,id),UNIQUE(tenant_id,statement_id,line_no),UNIQUE(tenant_id,entry_id),FOREIGN KEY(tenant_id,statement_id) REFERENCES ab.finance_statements(tenant_id,id),FOREIGN KEY(tenant_id,entry_id) REFERENCES ab.finance_entries(tenant_id,id));
CREATE TABLE ab.finance_notification_rules(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,user_id uuid NOT NULL,action text NOT NULL,region text NOT NULL DEFAULT '',job_title text NOT NULL DEFAULT '',created_by uuid NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,user_id,action),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_notifications(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,user_id uuid NOT NULL,action text NOT NULL,event_key text NOT NULL,entity_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,event_key),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_expense_requests(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,path text NOT NULL CHECK(path IN('prior_approval','operational')),amount numeric(21,3) NOT NULL CHECK(amount>0),currency char(3) NOT NULL,reason text NOT NULL,
 operation_id uuid,document_version_id uuid,status text NOT NULL DEFAULT 'Draft' CHECK(status IN('Draft','Approved','Rejected')),created_by uuid NOT NULL,approved_by uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,operation_id) REFERENCES ab.finance_operations(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id) REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.finance_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,actor_id uuid NOT NULL,entity_type text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,payload_cipher text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES ab.users(tenant_id,id));
-- Schema-level safeguards: immutable posted operations and entries; no negative/duplicate journal lines.
CREATE FUNCTION ab.finance_immutable_posted() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status<>'Draft' THEN RAISE EXCEPTION 'terminal financial operation' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER finance_posted_immutable BEFORE UPDATE ON ab.finance_operations FOR EACH ROW EXECUTE FUNCTION ab.finance_immutable_posted();
CREATE FUNCTION ab.finance_immutable_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable financial history' USING ERRCODE='23514';END $$;
CREATE TRIGGER finance_entries_immutable BEFORE UPDATE OR DELETE ON ab.finance_entries FOR EACH ROW EXECUTE FUNCTION ab.finance_immutable_row();
CREATE FUNCTION ab.finance_balanced_operation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM ab.finance_operations WHERE tenant_id=NEW.tenant_id AND id=NEW.operation_id AND status='Approved') AND EXISTS(SELECT 1 FROM ab.finance_entries WHERE tenant_id=NEW.tenant_id AND operation_id=NEW.operation_id GROUP BY company_id,currency HAVING sum(debit)<>sum(credit)) THEN RAISE EXCEPTION 'unbalanced journal' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER finance_balanced AFTER INSERT ON ab.finance_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.finance_balanced_operation();
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['finance_chart','finance_cheques','finance_operations','finance_entries','finance_receipts','finance_handovers','finance_handover_items','finance_statements','finance_statement_lines','finance_notification_rules','finance_notifications','finance_expense_requests','finance_events'] LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_scope ON ab.%I USING(tenant_id=ab.tenant()) WITH CHECK(tenant_id=ab.tenant())',t);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',t);
 END LOOP;END $$;
GRANT UPDATE ON ab.finance_operations,ab.finance_cheques,ab.finance_receipts,ab.finance_handovers,ab.finance_statements,ab.finance_statement_lines,ab.finance_expense_requests TO ab_runtime;
CREATE INDEX finance_entries_bank ON ab.finance_entries(tenant_id,bank_account_id);
CREATE INDEX finance_operations_date ON ab.finance_operations(tenant_id,company_id,effective_on);

CREATE FUNCTION ab.finance_entry_draft_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM ab.finance_operations o JOIN ab.finance_chart a ON a.tenant_id=o.tenant_id AND a.id=NEW.chart_id WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.operation_id AND o.status='Draft' AND a.company_id=NEW.company_id AND a.currency=NEW.currency AND o.currency=NEW.currency AND a.bank_account_id IS NOT DISTINCT FROM NEW.bank_account_id) THEN RAISE EXCEPTION 'posted entries are append protected' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER finance_entries_draft_only BEFORE INSERT ON ab.finance_entries FOR EACH ROW EXECUTE FUNCTION ab.finance_entry_draft_only();
CREATE FUNCTION ab.finance_operation_balanced() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='Approved' AND (NOT EXISTS(SELECT 1 FROM ab.finance_entries WHERE tenant_id=NEW.tenant_id AND operation_id=NEW.id) OR EXISTS(SELECT 1 FROM ab.finance_entries WHERE tenant_id=NEW.tenant_id AND operation_id=NEW.id GROUP BY company_id,currency HAVING sum(debit)<>sum(credit) OR count(*)<2)) THEN RAISE EXCEPTION 'posted operation must balance per company' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER finance_operation_balance AFTER INSERT OR UPDATE ON ab.finance_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ab.finance_operation_balanced();
