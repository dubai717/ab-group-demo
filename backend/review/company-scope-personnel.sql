-- REVIEW ONLY: absent from manifests/runtime. Synthetic installation only.
-- Personal employee identity differs from legal employer and dated work assignments.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 -- Existing pre-auth/leave SECURITY DEFINER functions need their established owner
 -- visibility after FORCE. Refuse unknown non-bypass owners; never grant bypass.
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'personnel authentication owner review required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL THEN RAISE EXCEPTION 'reviewed scope prerequisite required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'reviewed runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname IN('hr_employees','hr_assignments')AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own personnel source' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='ab.hr_assignments'::pg_catalog.regclass AND polname='reviewed_company_upper_bound'AND NOT polpermissive)THEN RAISE EXCEPTION 'reviewed assignment upper bound required' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.hr_employees FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_employee_scope_read ON ab.hr_employees AS RESTRICTIVE FOR SELECT TO ab_runtime USING(
 tenant_id=ab.tenant()AND(
  ab.current_company_scope_ids()IS NULL
  OR user_id=nullif(pg_catalog.current_setting('ab.actor',true),'')::pg_catalog.uuid
  OR company_id=ANY(ab.current_company_scope_ids())
  OR EXISTS(SELECT 1 FROM ab.hr_assignments a WHERE a.tenant_id=hr_employees.tenant_id AND a.employee_id=hr_employees.id
   AND a.effective_on<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::date AND(a.until_on IS NULL OR a.until_on>=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::date)
   AND a.company_id=ANY(ab.current_company_scope_ids()))
 )
);
-- Self/assignment visibility is not permission to change another legal employer's record.
CREATE POLICY reviewed_employee_scope_insert ON ab.hr_employees AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
CREATE POLICY reviewed_employee_scope_update ON ab.hr_employees AS RESTRICTIVE FOR UPDATE TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())))WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
CREATE POLICY reviewed_employee_scope_delete ON ab.hr_employees AS RESTRICTIVE FOR DELETE TO ab_runtime USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
COMMIT;
