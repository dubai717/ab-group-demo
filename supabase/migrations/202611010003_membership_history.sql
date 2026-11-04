ALTER TABLE ab.user_companies ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE ab.user_departments ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE FUNCTION ab.replace_memberships(person uuid,org uuid,companies uuid[],departments uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
BEGIN
 UPDATE ab.user_companies SET active=false WHERE user_id=person;
 INSERT INTO ab.user_companies(tenant_id,user_id,company_id,active) SELECT org,person,x,true FROM unnest(companies) x ON CONFLICT(user_id,company_id) DO UPDATE SET active=true;
 UPDATE ab.user_departments SET active=false WHERE user_id=person;
 INSERT INTO ab.user_departments(tenant_id,user_id,department_id,active) SELECT org,person,x,true FROM unnest(departments) x ON CONFLICT(user_id,department_id) DO UPDATE SET active=true;
END $$;
REVOKE ALL ON FUNCTION ab.replace_memberships(uuid,uuid,uuid[],uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.replace_memberships(uuid,uuid,uuid[],uuid[]) TO ab_runtime;
