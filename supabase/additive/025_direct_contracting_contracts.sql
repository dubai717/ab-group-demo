-- Reuse the contract engine with a direct external party; never manufacture a CRM lead/customer.
ALTER TABLE ab.marketing_contracts ADD COLUMN contracting_company_id uuid,ALTER COLUMN prospect_id DROP NOT NULL,
 ADD CONSTRAINT contract_external_party FOREIGN KEY(tenant_id,company_id,contracting_company_id)REFERENCES ab.contracting_companies(tenant_id,company_id,id),
 ADD CONSTRAINT contract_exact_source CHECK(num_nonnulls(prospect_id,contracting_company_id)=1);
CREATE FUNCTION ab.contract_source_immutable()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF(NEW.id,NEW.tenant_id,NEW.company_id,NEW.prospect_id,NEW.contracting_company_id,NEW.created_by,NEW.created_at)IS DISTINCT FROM(OLD.id,OLD.tenant_id,OLD.company_id,OLD.prospect_id,OLD.contracting_company_id,OLD.created_by,OLD.created_at)THEN RAISE EXCEPTION 'immutable contract party' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER contract_source_immutable BEFORE UPDATE ON ab.marketing_contracts FOR EACH ROW EXECUTE FUNCTION ab.contract_source_immutable();
CREATE FUNCTION ab.contract_link_party_valid()RETURNS trigger LANGUAGE plpgsql AS $$DECLARE target uuid;prospect uuid;BEGIN
 IF NEW.contract_id IS NOT NULL THEN SELECT contracting_company_id,prospect_id INTO target,prospect FROM ab.marketing_contracts WHERE id=NEW.contract_id AND tenant_id=NEW.tenant_id;
 IF(target IS NOT NULL AND target<>NEW.contracting_company_id)OR EXISTS(SELECT 1 FROM ab.contracting_links l WHERE l.tenant_id=NEW.tenant_id AND l.prospect_id=prospect AND l.contracting_company_id<>NEW.contracting_company_id)THEN RAISE EXCEPTION 'contract legal party mismatch' USING ERRCODE='23514';END IF;
 ELSIF NEW.prospect_id IS NOT NULL AND EXISTS(SELECT 1 FROM ab.contracting_links l JOIN ab.marketing_contracts c ON c.id=l.contract_id WHERE l.tenant_id=NEW.tenant_id AND c.prospect_id=NEW.prospect_id AND l.contracting_company_id<>NEW.contracting_company_id)THEN RAISE EXCEPTION 'prospect legal party mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END$$;
CREATE TRIGGER contract_link_party_valid BEFORE INSERT ON ab.contracting_links FOR EACH ROW EXECUTE FUNCTION ab.contract_link_party_valid();
REVOKE ALL ON FUNCTION ab.contract_source_immutable(),ab.contract_link_party_valid()FROM PUBLIC;
CREATE FUNCTION ab.contract_view_access(co uuid)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT ab.contracting_access(co,'view')OR EXISTS(SELECT 1 FROM ab.users u JOIN ab.roles r ON r.id=u.role_id WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.tenant_id=ab.tenant()AND u.status='Active'AND r.data->'permissions'?'view_marketing'AND EXISTS(SELECT 1 FROM ab.user_companies uc WHERE uc.tenant_id=u.tenant_id AND uc.user_id=u.id AND uc.company_id=co AND uc.active))
$$;
REVOKE ALL ON FUNCTION ab.contract_view_access(uuid)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.contract_view_access(uuid)TO ab_runtime;
CREATE POLICY contract_management_scope ON ab.marketing_contracts AS RESTRICTIVE TO ab_runtime USING(ab.contract_view_access(company_id))WITH CHECK(ab.contracting_access(company_id,'contracts'));
