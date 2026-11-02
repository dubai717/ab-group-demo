-- Forward-only integrity corrections. Existing data is never rewritten or deleted.
-- NOT VALID installs guards; validation fails the entire migration if legacy rows
-- need an operator-reviewed correction. No silent repair or weakened permission.
ALTER TABLE ab.companies ADD CONSTRAINT company_area_requires_emirate
 CHECK (area_id IS NULL OR emirate_id IS NOT NULL) NOT VALID;
ALTER TABLE ab.area_aliases ADD CONSTRAINT alias_matches_area_emirate
 FOREIGN KEY(tenant_id,emirate_id,area_id) REFERENCES ab.areas(tenant_id,emirate_id,id) NOT VALID;
ALTER TABLE ab.bank_accounts ADD CONSTRAINT closed_account_requires_date
 CHECK(status<>'Closed' OR (closed_on IS NOT NULL AND closed_on>=opened_on)) NOT VALID;
ALTER TABLE ab.users ADD CONSTRAINT user_cannot_manage_self
 CHECK(manager_id IS NULL OR manager_id<>id) NOT VALID;

CREATE FUNCTION ab.check_document_owner_links() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
DECLARE parent ab.documents;
BEGIN
 IF NEW.related_id IS NOT NULL THEN
  SELECT * INTO parent FROM ab.documents WHERE tenant_id=NEW.tenant_id AND id=NEW.related_id;
  IF NOT FOUND OR ROW(NEW.company_id,NEW.bank_account_id,NEW.user_id)
   IS DISTINCT FROM ROW(parent.company_id,parent.bank_account_id,parent.user_id) THEN
   RAISE EXCEPTION 'document parent must have the same owner' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM ab.documents child
  WHERE child.tenant_id=NEW.tenant_id AND child.related_id=NEW.id AND
   ROW(child.company_id,child.bank_account_id,child.user_id)
   IS DISTINCT FROM ROW(NEW.company_id,NEW.bank_account_id,NEW.user_id)) THEN
  RAISE EXCEPTION 'document owner change would invalidate child links' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.check_document_owner_links() FROM PUBLIC;
CREATE TRIGGER document_owner_links BEFORE INSERT OR UPDATE ON ab.documents
 FOR EACH ROW EXECUTE FUNCTION ab.check_document_owner_links();

CREATE FUNCTION ab.check_version_parent_owner() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
DECLARE child ab.documents; parent ab.documents;
BEGIN
 IF NEW.parent_version_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO child FROM ab.documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'version document missing' USING ERRCODE='23503'; END IF;
 SELECT d.* INTO parent FROM ab.document_versions v JOIN ab.documents d
  ON d.tenant_id=v.tenant_id AND d.id=v.document_id
  WHERE v.tenant_id=NEW.tenant_id AND v.id=NEW.parent_version_id;
 IF NOT FOUND OR ROW(child.company_id,child.bank_account_id,child.user_id)
   IS DISTINCT FROM ROW(parent.company_id,parent.bank_account_id,parent.user_id)
   OR (parent.id<>child.id AND child.related_id IS DISTINCT FROM parent.id) THEN
  RAISE EXCEPTION 'version parent must match document owner and relationship' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ab.check_version_parent_owner() FROM PUBLIC;
CREATE TRIGGER version_parent_owner BEFORE INSERT OR UPDATE ON ab.document_versions
 FOR EACH ROW EXECUTE FUNCTION ab.check_version_parent_owner();

ALTER TABLE ab.companies VALIDATE CONSTRAINT company_area_requires_emirate;
ALTER TABLE ab.area_aliases VALIDATE CONSTRAINT alias_matches_area_emirate;
ALTER TABLE ab.bank_accounts VALIDATE CONSTRAINT closed_account_requires_date;
ALTER TABLE ab.users VALIDATE CONSTRAINT user_cannot_manage_self;
-- Triggers do not validate pre-existing rows; explicitly check them as well.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ab.documents c LEFT JOIN ab.documents p
  ON p.tenant_id=c.tenant_id AND p.id=c.related_id
  WHERE c.related_id IS NOT NULL AND (p.id IS NULL OR
   ROW(c.company_id,c.bank_account_id,c.user_id) IS DISTINCT FROM ROW(p.company_id,p.bank_account_id,p.user_id))) THEN
  RAISE EXCEPTION 'existing document owner links require reviewed correction' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM ab.document_versions v
  JOIN ab.documents c ON c.tenant_id=v.tenant_id AND c.id=v.document_id
  LEFT JOIN ab.document_versions pv ON pv.tenant_id=v.tenant_id AND pv.id=v.parent_version_id
  LEFT JOIN ab.documents p ON p.tenant_id=pv.tenant_id AND p.id=pv.document_id
  WHERE v.parent_version_id IS NOT NULL AND (p.id IS NULL OR
   ROW(c.company_id,c.bank_account_id,c.user_id) IS DISTINCT FROM ROW(p.company_id,p.bank_account_id,p.user_id)
   OR (p.id<>c.id AND c.related_id IS DISTINCT FROM p.id))) THEN
  RAISE EXCEPTION 'existing version links require reviewed correction' USING ERRCODE='23514';
 END IF;
END $$;
