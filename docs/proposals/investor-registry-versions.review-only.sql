-- REVIEW ONLY. Not in the hosted migration catalog. Run only on a fresh isolated test copy.
-- No UPDATE/DELETE of existing rows, no balance backfill, and no role/user grants.
ALTER TABLE ab.investor_profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ab.investor_profiles ADD COLUMN identity_hash text;
CREATE UNIQUE INDEX investor_identity_unique ON ab.investor_profiles(tenant_id,identity_hash)WHERE identity_hash IS NOT NULL;
CREATE FUNCTION ab.investor_registry_owner()RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$SELECT EXISTS(SELECT 1 FROM ab.users WHERE id=nullif(current_setting('ab.actor',true),'')::uuid AND tenant_id=ab.tenant()AND status='Active'AND role_id='owner')$$;
REVOKE ALL ON FUNCTION ab.investor_registry_owner()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_registry_owner()TO ab_runtime;
CREATE POLICY independent_investor_read ON ab.investor_profiles FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_registry_owner());
CREATE POLICY independent_investor_create ON ab.investor_profiles FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND ab.investor_registry_owner());
CREATE TABLE ab.investor_profile_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,investor_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),status text NOT NULL CHECK(status IN('Active','Suspended','Terminated')),payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,investor_id,revision),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_identity_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,investor_id uuid NOT NULL,identity_hash text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,identity_hash),UNIQUE(tenant_id,investor_id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_agreement_series(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,agreement_id uuid NOT NULL,investor_id uuid NOT NULL,company_id uuid NOT NULL,currency char(3)NOT NULL,scope text NOT NULL,number text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,agreement_id),UNIQUE(tenant_id,investor_id,company_id,currency,scope),UNIQUE(tenant_id,number),
 FOREIGN KEY(tenant_id,company_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,company_id,id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_agreement_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,series_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),effective_on date NOT NULL,document_version_id uuid NOT NULL,terms_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,series_id,version),UNIQUE(tenant_id,series_id,id,effective_on),UNIQUE(tenant_id,document_version_id),
 FOREIGN KEY(tenant_id,series_id)REFERENCES ab.investor_agreement_series(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_version_approvals(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,series_id uuid NOT NULL,version_id uuid NOT NULL,effective_on date NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,version_id),UNIQUE(tenant_id,series_id,effective_on),FOREIGN KEY(tenant_id,series_id,version_id,effective_on)REFERENCES ab.investor_agreement_versions(tenant_id,series_id,id,effective_on),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_funding_versions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,funding_id uuid NOT NULL,version_id uuid NOT NULL,approved_on date NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,funding_id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,version_id)REFERENCES ab.investor_agreement_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_profile_documents(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,investor_id uuid NOT NULL,version_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('identity','license','bank','other')),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,version_id),FOREIGN KEY(tenant_id,investor_id)REFERENCES ab.investor_profiles(tenant_id,id),FOREIGN KEY(tenant_id,version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_principal_releases(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,funding_id uuid NOT NULL,amount numeric(21,3)NOT NULL CHECK(amount>0),effective_on date NOT NULL,document_version_id uuid NOT NULL,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_principal_release_reversals(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,release_id uuid NOT NULL,funding_id uuid NOT NULL,effective_on date NOT NULL,document_version_id uuid NOT NULL,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,release_id),FOREIGN KEY(tenant_id,release_id)REFERENCES ab.investor_principal_releases(tenant_id,id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_registration_sources(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,funding_id uuid NOT NULL,invoice_id uuid NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,funding_id),UNIQUE(tenant_id,invoice_id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id)REFERENCES ab.vehicle_invoices(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.investor_financing_settlements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,funding_id uuid NOT NULL,document_version_id uuid NOT NULL,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,funding_id),FOREIGN KEY(tenant_id,funding_id)REFERENCES ab.investor_funding_requests(tenant_id,id),FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE FUNCTION ab.investor_registry_read(profile uuid)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$SELECT ab.investor_registry_owner()OR ab.investor_own(profile)OR EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.tenant_id=ab.tenant()AND a.investor_id=profile AND ab.investor_company_access(a.company_id,false))$$;
REVOKE ALL ON FUNCTION ab.investor_registry_read(uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_registry_read(uuid)TO ab_runtime;
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['investor_identity_links','investor_profile_versions','investor_agreement_series','investor_agreement_versions','investor_version_approvals','investor_funding_versions','investor_profile_documents','investor_principal_releases','investor_principal_release_reversals','investor_registration_sources','investor_financing_settlements']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
 EXECUTE format('CREATE POLICY tenant_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed())WITH CHECK(tenant_id=ab.tenant()AND ab.hr_actor_allowed())',tab);
 EXECUTE format('CREATE POLICY owner_create ON ab.%I FOR INSERT WITH CHECK(ab.investor_registry_owner()AND created_by=nullif(current_setting(''ab.actor'',true),'''')::uuid)',tab);
END LOOP;END$$;
CREATE POLICY scoped_read ON ab.investor_profile_versions FOR SELECT USING(ab.investor_registry_read(investor_id));
CREATE POLICY scoped_read ON ab.investor_agreement_series FOR SELECT USING(ab.investor_registry_read(investor_id));
CREATE POLICY scoped_read ON ab.investor_agreement_versions FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_agreement_series s WHERE s.id=series_id AND s.tenant_id=ab.tenant()AND ab.investor_agreement_access(s.agreement_id,false)));
CREATE POLICY scoped_read ON ab.investor_version_approvals FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_agreement_series s WHERE s.id=series_id AND s.tenant_id=ab.tenant()AND ab.investor_agreement_access(s.agreement_id,false)));
CREATE POLICY scoped_read ON ab.investor_funding_versions FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=funding_id AND f.tenant_id=ab.tenant()AND ab.investor_agreement_access(f.agreement_id,false)));
CREATE POLICY scoped_read ON ab.investor_profile_documents FOR SELECT USING(ab.investor_registry_read(investor_id));
CREATE POLICY scoped_read ON ab.investor_principal_releases FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=funding_id AND f.tenant_id=ab.tenant()AND ab.investor_agreement_access(f.agreement_id,false)));
CREATE POLICY scoped_read ON ab.investor_registration_sources FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=funding_id AND f.tenant_id=ab.tenant()AND ab.investor_agreement_access(f.agreement_id,false)));
CREATE POLICY scoped_read ON ab.investor_financing_settlements FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=funding_id AND f.tenant_id=ab.tenant()AND ab.investor_agreement_access(f.agreement_id,false)));
CREATE FUNCTION ab.investor_version_binding_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$DECLARE expected uuid;root uuid;BEGIN
 SELECT s.agreement_id INTO root FROM ab.investor_agreement_versions v JOIN ab.investor_agreement_series s ON s.id=v.series_id AND s.tenant_id=v.tenant_id WHERE v.id=NEW.version_id AND v.tenant_id=NEW.tenant_id;
 SELECT v.id INTO expected FROM ab.investor_agreement_versions v JOIN ab.investor_version_approvals ap ON ap.version_id=v.id AND ap.tenant_id=v.tenant_id JOIN ab.investor_agreement_series s ON s.id=v.series_id WHERE s.agreement_id=root AND s.tenant_id=NEW.tenant_id AND v.effective_on<=NEW.approved_on ORDER BY v.effective_on DESC LIMIT 1;
 IF expected IS DISTINCT FROM NEW.version_id OR NEW.approved_on<>(timezone('Asia/Dubai',now()))::date OR NOT EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=NEW.funding_id AND f.tenant_id=NEW.tenant_id AND f.agreement_id=root)OR NOT EXISTS(SELECT 1 FROM ab.investor_agreement_versions v JOIN ab.document_versions d ON d.id=v.document_version_id JOIN ab.documents doc ON doc.id=d.document_id JOIN ab.investor_agreement_series sr ON sr.id=v.series_id JOIN ab.investor_agreements a ON a.id=sr.agreement_id WHERE v.id=NEW.version_id AND v.tenant_id=NEW.tenant_id AND d.scan_status='clean'AND a.state='Active'AND NOT EXISTS(SELECT 1 FROM ab.audit_events ev WHERE ev.entity_type='document'AND ev.entity_id=doc.id::text AND ev.action='attachment_withdrawn')) THEN RAISE EXCEPTION 'current approved investor version required' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_version_binding_guard BEFORE INSERT ON ab.investor_funding_versions FOR EACH ROW EXECUTE FUNCTION ab.investor_version_binding_guard();
REVOKE ALL ON FUNCTION ab.investor_version_binding_guard()FROM PUBLIC;

CREATE POLICY independent_profile_scope ON ab.investor_profiles FOR SELECT USING(tenant_id=ab.tenant()AND ab.hr_actor_allowed()AND ab.investor_registry_read(id));
CREATE FUNCTION ab.investor_binding_budget()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$DECLARE root uuid;received numeric;released numeric;spent numeric;withdrawn numeric;reserved numeric;BEGIN
 SELECT f.agreement_id INTO root FROM ab.investor_funding_requests f WHERE f.id=NEW.funding_id AND f.tenant_id=NEW.tenant_id;
 PERFORM 1 FROM ab.investor_agreements WHERE id=root AND tenant_id=NEW.tenant_id FOR UPDATE;
 SELECT coalesce(sum(o.amount),0)INTO received FROM ab.investor_capital_links l JOIN ab.finance_operations o ON o.id=l.operation_id AND o.tenant_id=l.tenant_id WHERE l.agreement_id=root AND l.tenant_id=NEW.tenant_id AND o.status='Approved'AND o.kind='receipt';
 SELECT coalesce(sum(x.amount),0)INTO released FROM ab.investor_principal_releases x JOIN ab.investor_funding_requests f ON f.id=x.funding_id AND f.tenant_id=x.tenant_id WHERE f.agreement_id=root AND x.tenant_id=NEW.tenant_id AND NOT EXISTS(SELECT 1 FROM ab.investor_principal_release_reversals rev WHERE rev.release_id=x.id AND rev.tenant_id=x.tenant_id);
 SELECT coalesce(sum(v.amount),0)INTO spent FROM ab.vehicle_funds v JOIN ab.investor_funding_requests f ON f.request_id=v.request_id AND f.tenant_id=v.tenant_id WHERE f.agreement_id=root AND f.tenant_id=NEW.tenant_id;
 SELECT coalesce(sum(v.amount),0)INTO withdrawn FROM ab.investor_payouts p JOIN ab.finance_vouchers v ON v.id=p.voucher_id AND v.tenant_id=p.tenant_id WHERE p.agreement_id=root AND p.tenant_id=NEW.tenant_id AND p.capital_source='unused'AND v.status<>'Cancelled';
 SELECT coalesce(sum(f.amount),0)INTO reserved FROM ab.investor_funding_requests f WHERE f.agreement_id=root AND f.tenant_id=NEW.tenant_id AND f.state IN('Requested','Accepted')AND f.financing_state<>'Terminated'AND NOT EXISTS(SELECT 1 FROM ab.vehicle_funds v WHERE v.request_id=f.request_id AND v.tenant_id=f.tenant_id);
 IF received+released-spent-withdrawn-reserved<0 THEN RAISE EXCEPTION 'investor available capital exceeded' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_binding_budget BEFORE INSERT ON ab.investor_funding_versions FOR EACH ROW EXECUTE FUNCTION ab.investor_binding_budget();
REVOKE ALL ON FUNCTION ab.investor_binding_budget()FROM PUBLIC;
CREATE FUNCTION ab.investor_registration_source_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM ab.investor_funding_requests f JOIN ab.vehicles v ON v.request_id=f.request_id AND v.tenant_id=f.tenant_id JOIN ab.vehicle_invoices i ON i.vehicle_id=v.id AND i.tenant_id=v.tenant_id JOIN ab.investor_agreements a ON a.id=f.agreement_id WHERE f.id=NEW.funding_id AND f.tenant_id=NEW.tenant_id AND i.id=NEW.invoice_id AND i.company_id=f.company_id AND i.currency=a.currency AND i.kind='admin')THEN RAISE EXCEPTION 'actual registration fee source required' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_registration_source_guard BEFORE INSERT ON ab.investor_registration_sources FOR EACH ROW EXECUTE FUNCTION ab.investor_registration_source_guard();
REVOKE ALL ON FUNCTION ab.investor_registration_source_guard()FROM PUBLIC;
CREATE OR REPLACE FUNCTION ab.investor_identity_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$
DECLARE owner_response boolean:=false;
BEGIN
 IF TG_TABLE_NAME='investor_agreements'THEN
  IF OLD.state='Terminated'AND NEW.state IS DISTINCT FROM OLD.state THEN RAISE EXCEPTION 'terminated investment cannot reactivate' USING ERRCODE='23514';END IF;
  IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.investor_id,NEW.mode,NEW.currency,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.investor_id,OLD.mode,OLD.currency,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'investor agreement identity immutable' USING ERRCODE='23514';END IF;
 ELSE
  IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.agreement_id,NEW.request_id,NEW.amount,NEW.terms_cipher,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.agreement_id,OLD.request_id,OLD.amount,OLD.terms_cipher,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'investor financing snapshot immutable' USING ERRCODE='23514';END IF;
  IF OLD.financing_state='Terminated'AND NEW.financing_state IS DISTINCT FROM OLD.financing_state THEN RAISE EXCEPTION 'terminated financing cannot reactivate' USING ERRCODE='23514';END IF;
  owner_response:=OLD.state='Requested'AND NEW.state='Accepted'AND NEW.financing_state=OLD.financing_state AND ab.investor_registry_owner()AND EXISTS(SELECT 1 FROM ab.investor_funding_versions b JOIN ab.investor_agreements a ON a.id=OLD.agreement_id JOIN ab.investor_profiles p ON p.id=a.investor_id WHERE b.funding_id=OLD.id AND b.tenant_id=OLD.tenant_id AND p.user_id IS NULL);
  IF NEW.response_cipher IS DISTINCT FROM OLD.response_cipher AND NOT(OLD.state='Requested'AND NEW.state IN('Accepted','Declined')AND EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.id=OLD.agreement_id AND a.tenant_id=OLD.tenant_id AND ab.investor_own(a.investor_id)) OR owner_response)THEN RAISE EXCEPTION 'investor response immutable' USING ERRCODE='42501';END IF;
  IF NEW.state IS DISTINCT FROM OLD.state THEN
   IF NOT(OLD.state='Requested'AND NEW.state IN('Accepted','Declined')AND EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.id=OLD.agreement_id AND a.tenant_id=OLD.tenant_id AND ab.investor_own(a.investor_id)) OR owner_response)THEN RAISE EXCEPTION 'investor response identity required' USING ERRCODE='42501';END IF;
  END IF;
  IF NEW.financing_state IS DISTINCT FROM OLD.financing_state AND NOT ab.investor_agreement_access(OLD.agreement_id,true)THEN RAISE EXCEPTION 'investment management required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END$$;
CREATE FUNCTION ab.investor_principal_release_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$DECLARE funded numeric;collected numeric;released numeric;reserved numeric;root uuid;BEGIN
 SELECT f.amount,f.agreement_id INTO funded,root FROM ab.investor_funding_requests f WHERE f.id=NEW.funding_id AND f.tenant_id=NEW.tenant_id;
 PERFORM 1 FROM ab.investor_agreements WHERE id=root AND tenant_id=NEW.tenant_id FOR UPDATE;
 SELECT coalesce(sum(ab.financial_allocation_total(i.id)),0)INTO collected FROM ab.vehicle_invoices i JOIN ab.vehicles v ON v.id=i.vehicle_id AND v.tenant_id=i.tenant_id JOIN ab.investor_funding_requests f ON f.request_id=v.request_id AND f.tenant_id=v.tenant_id WHERE f.id=NEW.funding_id AND f.tenant_id=NEW.tenant_id AND i.kind='finance';
 SELECT coalesce(sum(amount),0)INTO released FROM ab.investor_principal_releases rel WHERE funding_id=NEW.funding_id AND tenant_id=NEW.tenant_id AND NOT EXISTS(SELECT 1 FROM ab.investor_principal_release_reversals rev WHERE rev.release_id=rel.id AND rev.tenant_id=rel.tenant_id);
 SELECT coalesce(sum(v.amount),0)INTO reserved FROM ab.investor_payouts p JOIN ab.finance_vouchers v ON v.id=p.voucher_id AND v.tenant_id=p.tenant_id WHERE p.funding_request_id=NEW.funding_id AND p.tenant_id=NEW.tenant_id AND v.status<>'Cancelled';
 IF NEW.effective_on<>(timezone('Asia/Dubai',now()))::date OR released+reserved+NEW.amount>least(funded,collected)OR NOT EXISTS(SELECT 1 FROM ab.document_versions d JOIN ab.documents doc ON doc.id=d.document_id WHERE d.id=NEW.document_version_id AND d.tenant_id=NEW.tenant_id AND d.scan_status='clean'AND doc.company_id=(SELECT company_id FROM ab.investor_agreements WHERE id=root))THEN RAISE EXCEPTION 'collected principal source required' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_principal_release_guard BEFORE INSERT ON ab.investor_principal_releases FOR EACH ROW EXECUTE FUNCTION ab.investor_principal_release_guard();
REVOKE ALL ON FUNCTION ab.investor_principal_release_guard()FROM PUBLIC;
CREATE FUNCTION ab.investor_registry_link_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$BEGIN
 IF TG_TABLE_NAME='investor_agreement_series'THEN
  IF NOT EXISTS(SELECT 1 FROM ab.investor_agreements a WHERE a.id=NEW.agreement_id AND a.tenant_id=NEW.tenant_id AND a.investor_id=NEW.investor_id AND a.company_id=NEW.company_id AND a.currency=NEW.currency)THEN RAISE EXCEPTION 'investor agreement scope mismatch' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='investor_agreement_versions'THEN
  IF NOT EXISTS(SELECT 1 FROM ab.document_versions v JOIN ab.documents d ON d.id=v.document_id AND d.tenant_id=v.tenant_id JOIN ab.investor_agreement_series s ON s.company_id=d.company_id AND s.tenant_id=d.tenant_id WHERE v.id=NEW.document_version_id AND v.tenant_id=NEW.tenant_id AND s.id=NEW.series_id AND v.scan_status='clean'AND v.mime IN('application/pdf','image/png','image/jpeg','image/webp'))THEN RAISE EXCEPTION 'scanned independent version document required' USING ERRCODE='23514';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM ab.document_versions v JOIN ab.documents d ON d.id=v.document_id AND d.tenant_id=v.tenant_id WHERE v.id=NEW.version_id AND v.tenant_id=NEW.tenant_id AND d.user_id=NEW.created_by AND v.scan_status='clean')THEN RAISE EXCEPTION 'owned scanned profile document required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_registry_link_guard BEFORE INSERT ON ab.investor_agreement_series FOR EACH ROW EXECUTE FUNCTION ab.investor_registry_link_guard();
CREATE TRIGGER investor_registry_link_guard BEFORE INSERT ON ab.investor_agreement_versions FOR EACH ROW EXECUTE FUNCTION ab.investor_registry_link_guard();
CREATE TRIGGER investor_registry_link_guard BEFORE INSERT ON ab.investor_profile_documents FOR EACH ROW EXECUTE FUNCTION ab.investor_registry_link_guard();
REVOKE ALL ON FUNCTION ab.investor_registry_link_guard()FROM PUBLIC;

CREATE POLICY private_identity_read ON ab.investor_identity_links FOR SELECT USING(ab.investor_registry_owner());

CREATE POLICY scoped_read ON ab.investor_principal_release_reversals FOR SELECT USING(EXISTS(SELECT 1 FROM ab.investor_funding_requests f WHERE f.id=funding_id AND f.tenant_id=ab.tenant()AND ab.investor_agreement_access(f.agreement_id,false)));
CREATE FUNCTION ab.investor_release_reversal_guard()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$DECLARE root uuid;value numeric;received numeric;released numeric;spent numeric;withdrawn numeric;reserved numeric;BEGIN
 SELECT f.agreement_id,r.amount INTO root,value FROM ab.investor_principal_releases r JOIN ab.investor_funding_requests f ON f.id=r.funding_id AND f.tenant_id=r.tenant_id WHERE r.id=NEW.release_id AND r.funding_id=NEW.funding_id AND r.tenant_id=NEW.tenant_id;
 IF root IS NULL THEN RAISE EXCEPTION 'principal release source mismatch' USING ERRCODE='23514';END IF;
 PERFORM 1 FROM ab.investor_agreements WHERE id=root AND tenant_id=NEW.tenant_id FOR UPDATE;
 SELECT coalesce(sum(o.amount),0)INTO received FROM ab.investor_capital_links l JOIN ab.finance_operations o ON o.id=l.operation_id WHERE l.agreement_id=root AND l.tenant_id=NEW.tenant_id AND o.status='Approved';
 SELECT coalesce(sum(r.amount),0)INTO released FROM ab.investor_principal_releases r JOIN ab.investor_funding_requests f ON f.id=r.funding_id WHERE f.agreement_id=root AND r.tenant_id=NEW.tenant_id AND NOT EXISTS(SELECT 1 FROM ab.investor_principal_release_reversals x WHERE x.release_id=r.id AND x.tenant_id=r.tenant_id);
 SELECT coalesce(sum(v.amount),0)INTO spent FROM ab.vehicle_funds v JOIN ab.investor_funding_requests f ON f.request_id=v.request_id WHERE f.agreement_id=root AND v.tenant_id=NEW.tenant_id;
 SELECT coalesce(sum(v.amount),0)INTO withdrawn FROM ab.investor_payouts p JOIN ab.finance_vouchers v ON v.id=p.voucher_id WHERE p.agreement_id=root AND p.tenant_id=NEW.tenant_id AND p.capital_source='unused'AND v.status<>'Cancelled';
 SELECT coalesce(sum(f.amount),0)INTO reserved FROM ab.investor_funding_requests f WHERE f.agreement_id=root AND f.tenant_id=NEW.tenant_id AND f.state IN('Requested','Accepted')AND f.financing_state<>'Terminated'AND NOT EXISTS(SELECT 1 FROM ab.vehicle_funds v WHERE v.request_id=f.request_id AND v.tenant_id=f.tenant_id);
 IF received+released-spent-withdrawn-reserved<value OR NEW.effective_on<>(timezone('Asia/Dubai',now()))::date OR NOT EXISTS(SELECT 1 FROM ab.document_versions d JOIN ab.documents doc ON doc.id=d.document_id WHERE d.id=NEW.document_version_id AND d.tenant_id=NEW.tenant_id AND d.scan_status='clean'AND doc.company_id=(SELECT company_id FROM ab.investor_agreements WHERE id=root))THEN RAISE EXCEPTION 'released principal already reserved or source invalid' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER investor_release_reversal_guard BEFORE INSERT ON ab.investor_principal_release_reversals FOR EACH ROW EXECUTE FUNCTION ab.investor_release_reversal_guard();
REVOKE ALL ON FUNCTION ab.investor_release_reversal_guard()FROM PUBLIC;
-- Installed last: incomplete/manual DDL never enables the runtime feature.
CREATE FUNCTION ab.investor_registry_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'INVESTOR-REGISTRY-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.investor_registry_schema_version()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.investor_registry_schema_version()TO ab_runtime;
