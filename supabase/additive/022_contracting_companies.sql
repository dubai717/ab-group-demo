-- External contracting entities are not group legal entities or individual customers.
-- Definitions only: no existing role or user's grants are changed.
INSERT INTO ab.permissions(id)SELECT 'contracting_'||a FROM unnest(ARRAY['view','create','edit','activate','deactivate','contracts'])a ON CONFLICT DO NOTHING;
CREATE FUNCTION ab.contracting_access(co uuid,action text)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users u WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.tenant_id=ab.tenant()AND u.status='Active'AND(u.role_id='owner'OR EXISTS(SELECT 1 FROM ab.permission_grants g WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL AND g.permission_id='contracting_'||action AND(g.scope_type='group'OR(g.scope_type='company'AND g.company_id=co)))))
$$;
REVOKE ALL ON FUNCTION ab.contracting_access(uuid,text)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.contracting_access(uuid,text)TO ab_runtime;
CREATE TABLE ab.contracting_companies(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,
 identity_key text NOT NULL,name_key text NOT NULL,english_name_key text NOT NULL,status text NOT NULL DEFAULT 'Active' CHECK(status IN('Active','Inactive')),
 payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,id),UNIQUE(tenant_id,identity_key),UNIQUE(tenant_id,name_key),UNIQUE(tenant_id,english_name_key),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.contracting_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,contracting_company_id uuid NOT NULL,
 action text NOT NULL,payload_cipher text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE TABLE ab.contracting_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,contracting_company_id uuid NOT NULL,
 customer_id uuid,employee_id uuid,vehicle_id uuid,document_version_id uuid,contract_id uuid,prospect_id uuid,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(customer_id,employee_id,vehicle_id,document_version_id,contract_id,prospect_id)=1),
 FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,customer_id)REFERENCES ab.customers(tenant_id,id),
 FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,vehicle_id)REFERENCES ab.vehicles(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,document_version_id)REFERENCES ab.document_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,contract_id)REFERENCES ab.marketing_contracts(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,prospect_id)REFERENCES ab.marketing_prospects(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX contracting_link_unique ON ab.contracting_links(tenant_id,contracting_company_id,coalesce(customer_id,employee_id,vehicle_id,document_version_id,contract_id,prospect_id));
ALTER TABLE ab.contracting_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracting_read ON ab.contracting_companies FOR SELECT USING(tenant_id=ab.tenant()AND ab.contracting_access(company_id,'view'));
CREATE POLICY contracting_create ON ab.contracting_companies FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND ab.contracting_access(company_id,'create')AND created_by=nullif(current_setting('ab.actor',true),'')::uuid);
CREATE POLICY contracting_update ON ab.contracting_companies FOR UPDATE USING(tenant_id=ab.tenant()AND(ab.contracting_access(company_id,'edit')OR ab.contracting_access(company_id,'activate')OR ab.contracting_access(company_id,'deactivate')))WITH CHECK(tenant_id=ab.tenant());
CREATE FUNCTION ab.contracting_update_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'contracting identity immutable' USING ERRCODE='42501';END IF;
 IF(NEW.payload_cipher,NEW.identity_key,NEW.name_key,NEW.english_name_key)IS DISTINCT FROM(OLD.payload_cipher,OLD.identity_key,OLD.name_key,OLD.english_name_key)AND NOT ab.contracting_access(OLD.company_id,'edit')THEN RAISE EXCEPTION 'contracting edit denied' USING ERRCODE='42501';END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ab.contracting_access(OLD.company_id,CASE WHEN NEW.status='Active'THEN'activate'ELSE'deactivate'END)THEN RAISE EXCEPTION 'contracting status denied' USING ERRCODE='42501';END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'contracting revision invalid' USING ERRCODE='40001';END IF;RETURN NEW;
END$$;
CREATE TRIGGER contracting_update_guard BEFORE UPDATE ON ab.contracting_companies FOR EACH ROW EXECUTE FUNCTION ab.contracting_update_guard();
GRANT SELECT,INSERT,UPDATE ON ab.contracting_companies TO ab_runtime;
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['contracting_events','contracting_links']LOOP
 EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY contracting_read ON ab.%I FOR SELECT USING(tenant_id=ab.tenant()AND ab.contracting_access(company_id,''view''))',tab);
 EXECUTE format('CREATE POLICY contracting_write ON ab.%I FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting(''ab.actor'',true),'''')::uuid AND(ab.contracting_access(company_id,''create'')OR ab.contracting_access(company_id,''edit'')OR ab.contracting_access(company_id,''activate'')OR ab.contracting_access(company_id,''deactivate'')OR ab.contracting_access(company_id,''contracts'')))',tab);
 EXECUTE format('GRANT SELECT,INSERT ON ab.%I TO ab_runtime',tab);
 EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.%I FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable()',tab);
END LOOP;END$$;
CREATE UNIQUE INDEX contracting_prospect_party ON ab.contracting_links(tenant_id,prospect_id)WHERE prospect_id IS NOT NULL;
CREATE UNIQUE INDEX contracting_contract_party ON ab.contracting_links(tenant_id,contract_id)WHERE contract_id IS NOT NULL;

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['contracting_companies','contracting_events','contracting_links']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
