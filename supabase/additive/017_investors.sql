-- Investor tracking references existing Auth users, financing requests, actual bank operations and vouchers.
-- No parallel cash journal, no existing roles/grants changed.
CREATE TABLE ab.investor_profiles(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,user_id uuid NOT NULL,
 payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_agreements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,investor_id uuid NOT NULL,
 mode text NOT NULL CHECK(mode IN('prefunded','committed')),currency char(3)NOT NULL,state text NOT NULL DEFAULT 'Active'CHECK(state IN('Active','Inactive','Terminated')),
 payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_funding_requests(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,agreement_id uuid NOT NULL,request_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'Requested'CHECK(state IN('Requested','Accepted','Declined','Funded')),amount numeric(21,3)NOT NULL CHECK(amount>0),
 terms_cipher text NOT NULL,response_cipher text,financing_state text NOT NULL DEFAULT 'Active'CHECK(financing_state IN('Active','Inactive','Terminated')),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,request_id),FOREIGN KEY(tenant_id,company_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,company_id,id),FOREIGN KEY(tenant_id,request_id)REFERENCES ab.vehicle_requests(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_capital_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,agreement_id uuid NOT NULL,operation_id uuid NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,operation_id),
 FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,operation_id)REFERENCES ab.finance_operations(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_payouts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,agreement_id uuid NOT NULL,voucher_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('capital_refund','returns_payout')),source_capital_operation_id uuid,capital_source text CHECK(capital_source IN('unused','collected_principal')),funding_request_id uuid,month date,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='capital_refund')=(source_capital_operation_id IS NOT NULL AND capital_source IS NOT NULL)),CHECK((capital_source='collected_principal')IS NOT TRUE OR funding_request_id IS NOT NULL),CHECK(capital_source='collected_principal'OR funding_request_id IS NULL),UNIQUE(tenant_id,id),UNIQUE(tenant_id,voucher_id),FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,source_capital_operation_id)REFERENCES ab.finance_operations(tenant_id,id),FOREIGN KEY(tenant_id,funding_request_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,voucher_id)REFERENCES ab.finance_vouchers(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,investor_id uuid NOT NULL,agreement_id uuid,kind text NOT NULL,
 payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['investor_profiles','investor_agreements','investor_funding_requests','investor_capital_links','investor_payouts','investor_events']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 IF tab IN('investor_agreements','investor_funding_requests')THEN EXECUTE format('GRANT UPDATE ON ab.%I TO ab_runtime',tab);
 ELSE EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);END IF;
 END LOOP;END$$;

-- Investor visibility is also enforced in PostgreSQL; these functions only return authorization booleans.
CREATE FUNCTION ab.investor_company_access(co uuid,writing boolean DEFAULT false)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users u JOIN ab.roles r ON r.id=u.role_id WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.tenant_id=ab.tenant()AND u.status='Active'AND(u.role_id='owner'OR(u.role_id<>'investor'AND(
 ((r.data->'permissions')?(CASE WHEN writing THEN 'create_investment'ELSE 'view_investors'END)AND EXISTS(SELECT 1 FROM ab.user_companies x WHERE x.tenant_id=u.tenant_id AND x.user_id=u.id AND x.company_id=co AND x.active))
 OR(NOT writing AND EXISTS(SELECT 1 FROM ab.permission_grants g WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.permission_id IN('ledger_voucher_approve','ledger_settle')AND(g.scope_type='group'OR(g.scope_type='company'AND g.company_id=co))))
 ))))
$$;
CREATE FUNCTION ab.investor_own(profile uuid)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.investor_profiles p JOIN ab.users u ON u.id=p.user_id AND u.tenant_id=p.tenant_id WHERE p.tenant_id=ab.tenant()AND p.id=profile AND u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.status='Active')
$$;
CREATE FUNCTION ab.investor_profile_access(target uuid,writing boolean DEFAULT false)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.tenant_id=ab.tenant()AND u.status='Active'AND(u.role_id='owner'OR(NOT writing AND u.id=target)))
 OR EXISTS(SELECT 1 FROM ab.user_companies x WHERE x.tenant_id=ab.tenant()AND x.user_id=target AND ab.investor_company_access(x.company_id,writing))
 OR(NOT writing AND EXISTS(SELECT 1 FROM ab.investor_profiles p JOIN ab.investor_agreements a ON a.investor_id=p.id AND a.tenant_id=p.tenant_id WHERE p.tenant_id=ab.tenant()AND p.user_id=target AND ab.investor_company_access(a.company_id,false)))
$$;
CREATE FUNCTION ab.investor_agreement_access(agreement uuid,writing boolean DEFAULT false)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.tenant_id=ab.tenant()AND a.id=agreement AND(ab.investor_company_access(a.company_id,writing)OR(NOT writing AND ab.investor_own(a.investor_id))))
$$;
REVOKE ALL ON FUNCTION ab.investor_company_access(uuid,boolean),ab.investor_own(uuid),ab.investor_profile_access(uuid,boolean),ab.investor_agreement_access(uuid,boolean)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_company_access(uuid,boolean),ab.investor_own(uuid),ab.investor_profile_access(uuid,boolean),ab.investor_agreement_access(uuid,boolean)TO ab_runtime;

CREATE POLICY investor_read ON ab.investor_profiles FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_profile_access(user_id,false));
CREATE POLICY investor_create ON ab.investor_profiles FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_profile_access(user_id,true));
CREATE POLICY investor_read ON ab.investor_agreements FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND(ab.investor_own(investor_id)OR ab.investor_company_access(company_id,false)));
CREATE POLICY investor_create ON ab.investor_agreements FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_company_access(company_id,true));
CREATE POLICY investor_update ON ab.investor_agreements FOR UPDATE USING(tenant_id=ab.tenant()AND ab.investor_company_access(company_id,true))WITH CHECK(tenant_id=ab.tenant()AND ab.investor_company_access(company_id,true));
CREATE POLICY investor_read ON ab.investor_funding_requests FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_agreement_access(agreement_id,false));
CREATE POLICY investor_create ON ab.investor_funding_requests FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_agreement_access(agreement_id,true));
CREATE POLICY investor_update ON ab.investor_funding_requests FOR UPDATE USING(tenant_id=ab.tenant()AND ab.investor_agreement_access(agreement_id,false))WITH CHECK(tenant_id=ab.tenant()AND ab.investor_agreement_access(agreement_id,false));
CREATE POLICY investor_read ON ab.investor_capital_links FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_agreement_access(agreement_id,false));
CREATE POLICY investor_create ON ab.investor_capital_links FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_agreement_access(agreement_id,true));
CREATE POLICY investor_read ON ab.investor_payouts FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_agreement_access(agreement_id,false));
CREATE POLICY investor_create ON ab.investor_payouts FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_agreement_access(agreement_id,true));
CREATE POLICY investor_read ON ab.investor_events FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND EXISTS(SELECT 1 FROM ab.investor_profiles p WHERE p.tenant_id=ab.tenant()AND p.id=investor_id AND ab.investor_profile_access(p.user_id,false)));
CREATE POLICY investor_create ON ab.investor_events FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND((agreement_id IS NOT NULL AND ab.investor_agreement_access(agreement_id,true))OR EXISTS(SELECT 1 FROM ab.investor_profiles p WHERE p.tenant_id=ab.tenant()AND p.id=investor_id AND ab.investor_profile_access(p.user_id,true))OR(ab.investor_own(investor_id)AND kind IN('transfer_evidence_submitted','funding_response','capital_increase_requested','capital_reduction_requested','termination_requested'))));
CREATE FUNCTION ab.investor_identity_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
BEGIN
 IF TG_TABLE_NAME='investor_agreements'THEN
  IF OLD.state='Terminated'AND NEW.state IS DISTINCT FROM OLD.state THEN RAISE EXCEPTION 'terminated investment cannot reactivate' USING ERRCODE='23514';END IF;
  IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.investor_id,NEW.mode,NEW.currency,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.investor_id,OLD.mode,OLD.currency,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'investor agreement identity immutable' USING ERRCODE='23514';END IF;
 ELSE
  IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.agreement_id,NEW.request_id,NEW.amount,NEW.terms_cipher,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.agreement_id,OLD.request_id,OLD.amount,OLD.terms_cipher,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'investor financing snapshot immutable' USING ERRCODE='23514';END IF;
  IF OLD.financing_state='Terminated'AND NEW.financing_state IS DISTINCT FROM OLD.financing_state THEN RAISE EXCEPTION 'terminated financing cannot reactivate' USING ERRCODE='23514';END IF;
  IF NEW.response_cipher IS DISTINCT FROM OLD.response_cipher AND NOT(OLD.state='Requested'AND NEW.state IN('Accepted','Declined')AND EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.id=OLD.agreement_id AND a.tenant_id=OLD.tenant_id AND ab.investor_own(a.investor_id)))THEN RAISE EXCEPTION 'investor response immutable' USING ERRCODE='42501';END IF;
  IF NEW.state IS DISTINCT FROM OLD.state THEN
   IF NOT(OLD.state='Requested'AND NEW.state IN('Accepted','Declined')AND EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.id=OLD.agreement_id AND a.tenant_id=OLD.tenant_id AND ab.investor_own(a.investor_id)))THEN RAISE EXCEPTION 'investor response identity required' USING ERRCODE='42501';END IF;
  END IF;
  IF NEW.financing_state IS DISTINCT FROM OLD.financing_state AND NOT ab.investor_agreement_access(OLD.agreement_id,true)THEN RAISE EXCEPTION 'investment management required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_identity_guard BEFORE UPDATE ON ab.investor_agreements FOR EACH ROW EXECUTE FUNCTION ab.investor_identity_guard();
CREATE TRIGGER investor_identity_guard BEFORE UPDATE ON ab.investor_funding_requests FOR EACH ROW EXECUTE FUNCTION ab.investor_identity_guard();

CREATE FUNCTION ab.investor_financial_source_valid()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
DECLARE a ab.investor_agreements;op ab.finance_operations;v ab.finance_vouchers;bank_amount numeric;counter_amount numeric;BEGIN
 SELECT * INTO a FROM ab.investor_agreements WHERE id=NEW.agreement_id AND tenant_id=NEW.tenant_id;
 IF TG_TABLE_NAME='investor_capital_links'THEN
  SELECT * INTO op FROM ab.finance_operations WHERE id=NEW.operation_id AND tenant_id=NEW.tenant_id;
  IF op.status IS DISTINCT FROM 'Approved'OR op.kind IS DISTINCT FROM 'receipt'OR op.company_id IS DISTINCT FROM a.company_id OR op.currency IS DISTINCT FROM a.currency OR(op.integration_refs->>'investorAgreementId')IS DISTINCT FROM a.id::text OR op.effective_on>(timezone('Asia/Dubai',now()))::date OR NOT EXISTS(SELECT 1 FROM ab.finance_chart ch WHERE ch.id=op.counterpart_id AND ch.tenant_id=NEW.tenant_id AND ch.kind='liability')OR(op.cheque_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.finance_cheques ch WHERE ch.id=op.cheque_id AND ch.status='Collected'))THEN RAISE EXCEPTION 'verified investor capital receipt required' USING ERRCODE='23514';END IF;
  SELECT coalesce(sum(e.debit-e.credit),0)INTO bank_amount FROM ab.finance_entries e JOIN ab.finance_chart ch ON ch.id=e.chart_id AND ch.tenant_id=e.tenant_id WHERE e.tenant_id=NEW.tenant_id AND e.operation_id=op.id AND ch.bank_account_id=op.bank_account_id;
  SELECT coalesce(sum(e.credit-e.debit),0)INTO counter_amount FROM ab.finance_entries e WHERE e.tenant_id=NEW.tenant_id AND e.operation_id=op.id AND e.chart_id=op.counterpart_id;
  IF bank_amount<>op.amount OR counter_amount<>op.amount THEN RAISE EXCEPTION 'investor receipt must be posted' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO v FROM ab.finance_vouchers WHERE id=NEW.voucher_id AND tenant_id=NEW.tenant_id;
  IF v.company_id IS DISTINCT FROM a.company_id OR v.currency IS DISTINCT FROM a.currency OR v.status IS DISTINCT FROM 'Pending'OR v.source_key IS DISTINCT FROM('investor:'||NEW.kind||':'||NEW.id::text)THEN RAISE EXCEPTION 'investor payout voucher source mismatch' USING ERRCODE='23514';END IF;
  IF NEW.kind='capital_refund'AND NOT EXISTS(SELECT 1 FROM ab.investor_capital_links x WHERE x.tenant_id=NEW.tenant_id AND x.agreement_id=NEW.agreement_id AND x.operation_id=NEW.source_capital_operation_id)THEN RAISE EXCEPTION 'original investor capital source required' USING ERRCODE='23514';END IF;
  IF NEW.funding_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.tenant_id=NEW.tenant_id AND f.id=NEW.funding_request_id AND f.agreement_id=NEW.agreement_id)THEN RAISE EXCEPTION 'investor financing source mismatch' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_financial_source_valid BEFORE INSERT ON ab.investor_capital_links FOR EACH ROW EXECUTE FUNCTION ab.investor_financial_source_valid();
CREATE TRIGGER investor_financial_source_valid BEFORE INSERT ON ab.investor_payouts FOR EACH ROW EXECUTE FUNCTION ab.investor_financial_source_valid();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['investor_profiles','investor_agreements','investor_funding_requests','investor_capital_links','investor_payouts','investor_events']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
