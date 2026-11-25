-- REVIEW ONLY. Preserve original library action grants and exact document ownership.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('ab.current_company_scope_ids()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS (SELECT 1 FROM pg_class WHERE oid='ab.hr_library_versions'::regclass
   AND (NOT relrowsecurity OR pg_has_role('ab_runtime',relowner,'MEMBER')))
 THEN RAISE EXCEPTION 'reviewed personnel library scope prerequisites required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_company_upper_bound'
   AND polrelid='ab.hr_library'::regclass)
 THEN RAISE EXCEPTION 'reviewed personnel library parent boundary required' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.hr_library_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_personnel_library_version_parents ON ab.hr_library_versions AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND ((SELECT ab.current_company_scope_ids()) IS NULL OR EXISTS (
   SELECT 1 FROM ab.hr_library l
   JOIN ab.documents d ON d.tenant_id=l.tenant_id AND d.personnel_library_id=l.id
   JOIN ab.document_versions v ON v.tenant_id=d.tenant_id AND v.document_id=d.id
   WHERE l.tenant_id=hr_library_versions.tenant_id AND l.id=hr_library_versions.library_id
     AND v.id=hr_library_versions.version_id
 ))
);
COMMIT;
