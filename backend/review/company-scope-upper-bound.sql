-- REVIEW CANDIDATE ONLY. Never installed by runtime/manifests. No data backfill or live activation.
-- Opt-in upper bound on original non-null company rows. Not complete action/portfolio authorization.
BEGIN;
SET LOCAL search_path=pg_catalog,ab;
DO $$BEGIN IF current_user<>'postgres'THEN RAISE EXCEPTION 'reviewed migration owner required' USING ERRCODE='42501';END IF;END$$;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='ab_runtime'AND NOT r.rolsuper AND NOT r.rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE(r.rolsuper OR r.rolbypassrls)AND pg_has_role('ab_runtime',r.oid,'MEMBER'))THEN RAISE EXCEPTION 'reviewed non-bypass runtime required' USING ERRCODE='42501';END IF;END$$;
CREATE TABLE ab.user_access_scope_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,user_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),previous_id uuid,
 selection_kind text NOT NULL CHECK(selection_kind IN('group','companies','centres','emirates')),
 payload_cipher text NOT NULL CHECK(length(payload_cipher)>0),created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,id),UNIQUE(tenant_id,user_id,revision),
 CHECK((revision=1 AND previous_id IS NULL)OR(revision>1 AND previous_id IS NOT NULL)),
 FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id,previous_id)REFERENCES ab.user_access_scope_versions(tenant_id,user_id,id)
);
CREATE TABLE ab.user_access_scope_companies(
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,version_id uuid NOT NULL,company_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,version_id,company_id),
 FOREIGN KEY(tenant_id,user_id,version_id)REFERENCES ab.user_access_scope_versions(tenant_id,user_id,id),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id)
);
CREATE INDEX user_access_scope_current ON ab.user_access_scope_versions(tenant_id,user_id,revision DESC);
CREATE FUNCTION ab.user_access_scope_version_guard()RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE prior ab.user_access_scope_versions;
BEGIN
 IF NOT ab.operating_centre_owner()THEN RAISE EXCEPTION 'scope Owner required' USING ERRCODE='42501';END IF;
 IF NEW.created_by IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid THEN RAISE EXCEPTION 'scope actor mismatch' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM ab.users WHERE tenant_id=NEW.tenant_id AND id=NEW.user_id AND role_id='owner')THEN RAISE EXCEPTION 'Owner scope protected' USING ERRCODE='42501';END IF;
 NEW.created_at:=transaction_timestamp();
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':user-access-scope:'||NEW.user_id::text,0));
 SELECT * INTO prior FROM ab.user_access_scope_versions WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id ORDER BY revision DESC LIMIT 1;
 IF FOUND THEN
  IF NEW.previous_id IS DISTINCT FROM prior.id OR NEW.revision<>prior.revision+1 THEN RAISE EXCEPTION 'scope revision mismatch' USING ERRCODE='23514';END IF;
 ELSIF NEW.revision<>1 OR NEW.previous_id IS NOT NULL THEN RAISE EXCEPTION 'initial scope required' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ab.user_access_scope_link_guard()RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab,pg_temp AS $$
BEGIN
 IF NOT ab.operating_centre_owner()THEN RAISE EXCEPTION 'scope Owner required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM ab.user_access_scope_versions WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND id=NEW.version_id AND created_xid=pg_current_xact_id()AND created_at=transaction_timestamp())THEN RAISE EXCEPTION 'scope snapshot immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.user_access_scope_version_guard(),ab.user_access_scope_link_guard()FROM PUBLIC;
CREATE TRIGGER user_access_scope_version_guard BEFORE INSERT ON ab.user_access_scope_versions FOR EACH ROW EXECUTE FUNCTION ab.user_access_scope_version_guard();
CREATE TRIGGER user_access_scope_link_guard BEFORE INSERT ON ab.user_access_scope_companies FOR EACH ROW EXECUTE FUNCTION ab.user_access_scope_link_guard();
ALTER TABLE ab.user_access_scope_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.user_access_scope_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE ab.user_access_scope_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.user_access_scope_companies FORCE ROW LEVEL SECURITY;
CREATE POLICY user_access_scope_owner_read ON ab.user_access_scope_versions FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY user_access_scope_owner_insert ON ab.user_access_scope_versions FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY user_access_scope_link_owner_read ON ab.user_access_scope_companies FOR SELECT TO ab_runtime USING(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY user_access_scope_link_owner_insert ON ab.user_access_scope_companies FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND ab.operating_centre_owner());
CREATE POLICY user_access_scope_trusted_read ON ab.user_access_scope_versions FOR SELECT TO postgres USING(tenant_id=ab.tenant());
CREATE POLICY user_access_scope_link_trusted_read ON ab.user_access_scope_companies FOR SELECT TO postgres USING(tenant_id=ab.tenant());
REVOKE ALL ON ab.user_access_scope_versions,ab.user_access_scope_companies FROM PUBLIC,ab_runtime;
GRANT SELECT,INSERT ON ab.user_access_scope_versions,ab.user_access_scope_companies TO ab_runtime;
-- The only SECURITY DEFINER reader: zero caller-supplied identity, fixed source, no writes/private rows.
CREATE FUNCTION ab.current_company_scope_ids()RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab,pg_temp AS $$
DECLARE principal uuid:=nullif(current_setting('ab.actor',true),'')::uuid;org uuid:=ab.tenant();principal_role text;source uuid;ids uuid[];
BEGIN
 IF current_user<>'postgres'THEN RAISE EXCEPTION 'reviewed scope reader owner required' USING ERRCODE='42501';END IF;
 -- A forced-RLS reader must never mistake a hidden roster for an unconfigured legacy principal.
 IF(SELECT count(*)FROM pg_catalog.pg_policy WHERE polrelid IN('ab.user_access_scope_versions'::regclass,'ab.user_access_scope_companies'::regclass))<>6
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid IN('ab.user_access_scope_versions'::regclass,'ab.user_access_scope_companies'::regclass)AND NOT polpermissive)
 OR(SELECT count(*)FROM pg_catalog.pg_policy WHERE((polrelid='ab.user_access_scope_versions'::regclass AND polname='user_access_scope_trusted_read')OR(polrelid='ab.user_access_scope_companies'::regclass AND polname='user_access_scope_link_trusted_read'))AND polcmd='r'AND polpermissive AND polroles=ARRAY['postgres'::regrole::oid]AND replace(regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]()]','','g'),'ab.','')='tenant_id=tenant')<>2
 THEN RAISE EXCEPTION 'reviewed scope reader policies required' USING ERRCODE='42501';END IF;
 SELECT role_id INTO principal_role FROM ab.users WHERE tenant_id=org AND id=principal;
 -- Authentication and restricted self-service remain in their original controllers.
 -- A known unconfigured principal retains legacy row scope, including a held work account.
 IF NOT FOUND THEN RETURN '{}'::uuid[];END IF;
 IF principal_role='owner'THEN RETURN NULL;END IF;
 SELECT id INTO source FROM ab.user_access_scope_versions WHERE tenant_id=org AND user_id=principal ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT coalesce(array_agg(company_id ORDER BY company_id),'{}'::uuid[])INTO ids FROM ab.user_access_scope_companies WHERE tenant_id=org AND user_id=principal AND version_id=source;
 RETURN ids;
END $$;
REVOKE ALL ON FUNCTION ab.current_company_scope_ids()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.current_company_scope_ids()TO ab_runtime;
-- Strengthen ownership handling; do not disable/drop/replace the original tenant policies.
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='ab.companies'::regclass AND c.relkind='r'AND c.relrowsecurity AND NOT pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'original company tenant RLS is required';END IF;END$$;
ALTER TABLE ab.companies FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_company_upper_bound ON ab.companies AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND coalesce(id=ANY((SELECT ab.current_company_scope_ids())::uuid[]),true))WITH CHECK(tenant_id=ab.tenant()AND coalesce(id=ANY((SELECT ab.current_company_scope_ids())::uuid[]),true));
DO $$DECLARE source text;table_oid regclass;BEGIN
 FOREACH source IN ARRAY ARRAY['bank_accounts','collection_attempts','communication_threads','company_licenses','contracting_companies','contracting_events','contracting_links','customer_events','customer_imports','customer_templates','customer_visits','departments','finance_allocation_reversals','finance_card_charges','finance_card_settlements','finance_card_splits','finance_cards','finance_chart','finance_cheques','finance_credit_applications','finance_custody_moves','finance_custody_routes','finance_custody_transfers','finance_deposits','finance_entries','finance_events','finance_expense_requests','finance_funds','finance_handovers','finance_intercompany','finance_invoice_imports','finance_invoice_links','finance_journals','finance_kpi_facts','finance_notification_rules','finance_notifications','finance_operations','finance_periods','finance_receipt_batches','finance_receipts','finance_statements','finance_vouchers','finance_work_amounts','hr_assets','hr_assignments','hr_audit_events','hr_coaching','hr_compensation','hr_decisions','hr_delegations','hr_eos_estimates','hr_incentive_rules','hr_leave_balances','hr_leaves','hr_library','hr_models','hr_payroll','hr_provisions','hr_reserves','hr_reviews','hr_terminations','investor_agreements','investor_funding_requests','marketing_allocations','marketing_contract_bills','marketing_contracts','marketing_driver_enrollments','marketing_events','marketing_opportunities','marketing_prospects','marketing_services','marketing_targets','user_companies','vehicle_actions','vehicle_allocations','vehicle_billing_jobs','vehicle_circular_results','vehicle_circulars','vehicle_contracts','vehicle_events','vehicle_expense_payments','vehicle_expenses','vehicle_files','vehicle_funds','vehicle_imports','vehicle_invoice_adjustments','vehicle_invoices','vehicle_letter_templates','vehicle_letters','vehicle_recovery_tasks','vehicle_requests','vehicles']LOOP
  table_oid:=to_regclass('ab.'||source);
  IF table_oid IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE c.oid=table_oid AND c.relkind='r'AND c.relrowsecurity AND NOT pg_has_role('ab_runtime',c.relowner,'MEMBER')AND a.attname='company_id'AND a.atttypid='uuid'::regtype AND a.attnotnull AND NOT a.attisdropped)THEN RAISE EXCEPTION 'reviewed company source changed: %',source;END IF;
   EXECUTE format('ALTER TABLE ab.%I FORCE ROW LEVEL SECURITY',source);
   EXECUTE format('CREATE POLICY reviewed_company_upper_bound ON ab.%I AS RESTRICTIVE FOR ALL TO ab_runtime USING(tenant_id=ab.tenant()AND coalesce(company_id=ANY((SELECT ab.current_company_scope_ids())::uuid[]),true))WITH CHECK(tenant_id=ab.tenant()AND coalesce(company_id=ANY((SELECT ab.current_company_scope_ids())::uuid[]),true))',source);
  END IF;
 END LOOP;
END $$;
COMMIT;
