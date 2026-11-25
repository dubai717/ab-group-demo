-- REVIEW ONLY. Personnel document ownership is distinct from temporary work assignments.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('ab.current_company_scope_ids()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS (SELECT 1 FROM pg_class
   WHERE oid IN ('ab.documents'::regclass,'ab.document_versions'::regclass,'ab.hr_document_records'::regclass)
   AND (NOT relrowsecurity OR pg_has_role('ab_runtime',relowner,'MEMBER')))
 OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_employee_scope_read'
   AND polrelid='ab.hr_employees'::regclass)
 OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_company_upper_bound'
   AND polrelid='ab.hr_library'::regclass)
 THEN RAISE EXCEPTION 'reviewed personnel document scope prerequisites required' USING ERRCODE='42501';END IF;
END$$;

ALTER TABLE ab.documents FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_personnel_document_owner ON ab.documents AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND (
  (SELECT ab.current_company_scope_ids()) IS NULL
  OR (employee_id IS NULL AND personnel_library_id IS NULL)
  OR (employee_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM ab.hr_employees e
   WHERE e.tenant_id=documents.tenant_id AND e.id=documents.employee_id
    AND (e.company_id=ANY(ab.current_company_scope_ids())
      OR e.user_id=nullif(current_setting('ab.actor',true),'')::uuid)
  ))
  OR (personnel_library_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM ab.hr_library l WHERE l.tenant_id=documents.tenant_id AND l.id=documents.personnel_library_id
  ))
 )
);

ALTER TABLE ab.document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_personnel_document_version_owner ON ab.document_versions AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND ((SELECT ab.current_company_scope_ids()) IS NULL OR EXISTS (
  SELECT 1 FROM ab.documents d WHERE d.tenant_id=document_versions.tenant_id AND d.id=document_versions.document_id
 ))
);

ALTER TABLE ab.hr_document_records FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_employee_document_record_owner ON ab.hr_document_records AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND ((SELECT ab.current_company_scope_ids()) IS NULL OR EXISTS (
  SELECT 1 FROM ab.document_versions v JOIN ab.documents d ON d.tenant_id=v.tenant_id AND d.id=v.document_id
  WHERE v.tenant_id=hr_document_records.tenant_id AND v.id=hr_document_records.version_id
    AND d.employee_id=hr_document_records.employee_id
 ))
);
COMMIT;
